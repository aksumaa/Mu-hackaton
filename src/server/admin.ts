import argon2 from "argon2";
import type { Prisma, Role, StageKey, StageStatus, VerificationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { getSettings, saveSettings, type PlatformSettings } from "@/lib/settings";
import { aggregate, boundaryTieIds, hasDiscrepancy, rankByAverage, scoreSubmission } from "@/lib/scoring";
import { randomPassword } from "@/lib/storage";
import { tashkentInputToUtc } from "@/lib/time";
import { normalizeGroup } from "@/lib/utils";
import { verificationFor } from "@/server/participant";
import type { ActionResult } from "@/server/participant";
import type { ContentSection, FaqItem } from "@/lib/payload";

const transitions: Record<StageStatus, StageStatus[]> = {
  DRAFT: ["OPEN"],
  OPEN: ["CLOSED", "EVALUATING"],
  CLOSED: ["EVALUATING", "OPEN"],
  EVALUATING: ["CLOSED"],
  PUBLISHED: ["EVALUATING"],
};

export async function transitionStage(actorId: string, key: StageKey, status: StageStatus): Promise<ActionResult> {
  const stage = await prisma.stage.findUnique({ where: { key } });
  if (!stage) return { ok: false, code: "not_found" };
  if (!transitions[stage.status].includes(status)) return { ok: false, code: "invalid_transition" };
  if (status === "PUBLISHED") return { ok: false, code: "use_publish" };
  await prisma.stage.update({ where: { id: stage.id }, data: { status } });
  await audit({ actorId, action: "stage_transition", entity: "Stage", entityId: stage.id, meta: { from: stage.status, to: status } });
  return { ok: true, data: null };
}

export async function updateStageDates(actorId: string, key: StageKey, opensAt: string, updateDeadlineAt: string, deadlineAt: string): Promise<ActionResult> {
  const open = tashkentInputToUtc(opensAt);
  const update = tashkentInputToUtc(updateDeadlineAt);
  const deadline = tashkentInputToUtc(deadlineAt);
  if (!(open < update && update <= deadline)) return { ok: false, code: "invalid_dates" };
  const stage = await prisma.stage.update({
    where: { key },
    data: { opensAt: open, updateDeadlineAt: update, deadlineAt: deadline },
  });
  await audit({ actorId, action: "stage_dates", entity: "Stage", entityId: stage.id });
  return { ok: true, data: null };
}

export async function setVerification(actorId: string, memberId: string, status: VerificationStatus, note: string): Promise<ActionResult> {
  const member = await prisma.teamMember.update({
    where: { id: memberId },
    data: { verificationStatus: status, rejectionNote: status === "REJECTED" ? note.trim().slice(0, 500) : null },
    include: { team: true },
  });
  await notifyUser({
    userId: member.team.leaderId,
    type: "verification",
    titleKey: status === "VERIFIED" ? "verified" : status === "REJECTED" ? "rejected" : "verification_pending",
    payload: { studentId: member.studentId },
  });
  await audit({ actorId, action: "verification", entity: "TeamMember", entityId: memberId, meta: { status } });
  return { ok: true, data: null };
}

export async function setEligibilityOverride(actorId: string, teamId: string, value: boolean): Promise<ActionResult> {
  await prisma.team.update({ where: { id: teamId }, data: { eligibilityOverride: value } });
  await audit({ actorId, action: "eligibility_override", entity: "Team", entityId: teamId, meta: { value } });
  return { ok: true, data: null };
}

export async function resetUserPassword(actorId: string, userId: string): Promise<ActionResult<{ password: string }>> {
  const password = randomPassword();
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await argon2.hash(password), mustChangePassword: true },
  });
  await audit({ actorId, action: "reset_password", entity: "User", entityId: userId });
  return { ok: true, data: { password } };
}

export async function setUserActive(actorId: string, userId: string, isActive: boolean): Promise<ActionResult> {
  if (actorId === userId && !isActive) return { ok: false, code: "invalid_input" };
  await prisma.user.update({ where: { id: userId }, data: { isActive } });
  await audit({ actorId, action: isActive ? "activate_user" : "deactivate_user", entity: "User", entityId: userId });
  return { ok: true, data: null };
}

export async function createStaff(actorId: string, input: { fullName: string; studentId: string; role: Extract<Role, "JUDGE" | "ADMIN">; email?: string }): Promise<ActionResult<{ password: string }>> {
  if (input.fullName.trim().length < 3 || !/^[A-Za-z0-9-]{4,32}$/.test(input.studentId)) return { ok: false, code: "invalid_input" };
  const password = randomPassword();
  try {
    const user = await prisma.user.create({
      data: {
        fullName: input.fullName.trim(),
        studentId: input.studentId,
        role: input.role,
        email: input.email || null,
        passwordHash: await argon2.hash(password),
        mustChangePassword: true,
      },
    });
    await audit({ actorId, action: "create_staff", entity: "User", entityId: user.id, meta: { role: input.role } });
    return { ok: true, data: { password } };
  } catch {
    return { ok: false, code: "student_id_taken", field: "studentId" };
  }
}

export function parseRoster(text: string) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const rows = lines.map((line) => {
    const cells: string[] = [];
    let current = "";
    let quoted = false;
    for (const char of line) {
      if (char === '"') quoted = !quoted;
      else if (char === "," && !quoted) {
        cells.push(current.trim());
        current = "";
      } else current += char;
    }
    cells.push(current.trim());
    return cells;
  });
  const header = rows[0]?.map((cell) => cell.toLowerCase()) ?? [];
  const start = header.includes("studentid") ? 1 : 0;
  const index = (name: string, fallback: number) => {
    const found = header.indexOf(name);
    return found >= 0 ? found : fallback;
  };
  return rows.slice(start).map((cells, line) => ({
    line: line + start + 1,
    studentId: cells[index("studentid", 0)] ?? "",
    fullName: cells[index("fullname", 1)] ?? "",
    faculty: cells[index("faculty", 2)] ?? "",
    groupName: cells[index("group", 3)] ?? "",
  }));
}

export async function importRoster(actorId: string, text: string, commit: boolean): Promise<ActionResult<{ imported: number; errors: { line: number; code: string }[] }>> {
  const faculties = await prisma.faculty.findMany();
  const parsed = parseRoster(text);
  const errors: { line: number; code: string }[] = [];
  const seen = new Set<string>();
  const ready: { studentId: string; fullName: string; facultyId: string; groupName: string }[] = [];
  for (const row of parsed) {
    if (!/^[A-Za-z0-9-]{4,32}$/.test(row.studentId) || row.fullName.length < 3 || row.groupName.length < 2) {
      errors.push({ line: row.line, code: "invalid_row" });
      continue;
    }
    if (seen.has(row.studentId)) {
      errors.push({ line: row.line, code: "duplicate_row" });
      continue;
    }
    seen.add(row.studentId);
    const faculty = faculties.find((item) => [item.nameUz, item.nameRu, item.nameEn, item.id].some((value) => value.toLowerCase() === row.faculty.toLowerCase()));
    if (!faculty) {
      errors.push({ line: row.line, code: "unknown_faculty" });
      continue;
    }
    ready.push({ studentId: row.studentId, fullName: row.fullName, facultyId: faculty.id, groupName: row.groupName });
  }
  if (!commit) return { ok: true, data: { imported: ready.length, errors } };
  for (const row of ready) {
    await prisma.rosterEntry.upsert({
      where: { studentId: row.studentId },
      create: row,
      update: row,
    });
    const members = await prisma.teamMember.findMany({ where: { studentId: row.studentId } });
    for (const member of members) {
      if (member.verificationStatus === "REJECTED") continue;
      const status = member.facultyId === row.facultyId && normalizeGroup(member.groupName) === normalizeGroup(row.groupName) ? "VERIFIED" : "PENDING";
      await prisma.teamMember.update({ where: { id: member.id }, data: { verificationStatus: status } });
    }
  }
  await audit({ actorId, action: "roster_import", entity: "RosterEntry", meta: { imported: ready.length, errors: errors.length } });
  return { ok: true, data: { imported: ready.length, errors } };
}

export async function autoAssign(actorId: string, stageKey: StageKey): Promise<ActionResult<{ created: number }>> {
  const settings = await getSettings();
  const submissions = await prisma.submission.findMany({
    where: { stageKey, status: { not: "DRAFT" } },
    include: { assignments: true },
  });
  const judges = await prisma.user.findMany({ where: { role: "JUDGE", isActive: true } });
  const load = new Map(judges.map((judge) => [judge.id, 0]));
  const existing = await prisma.judgeAssignment.findMany({ where: { submission: { stageKey } } });
  for (const row of existing) load.set(row.judgeId, (load.get(row.judgeId) ?? 0) + 1);
  let created = 0;
  for (const submission of submissions) {
    const taken = new Set(submission.assignments.map((item) => item.judgeId));
    const needed = Math.max(0, settings.judgesPerSubmission - submission.assignments.filter((item) => !item.conflictDeclared).length);
    const pool = judges
      .filter((judge) => !taken.has(judge.id))
      .sort((a, b) => (load.get(a.id) ?? 0) - (load.get(b.id) ?? 0) || a.id.localeCompare(b.id));
    for (const judge of pool.slice(0, needed)) {
      await prisma.judgeAssignment.create({
        data: { judgeId: judge.id, submissionId: submission.id, assignedById: actorId },
      });
      load.set(judge.id, (load.get(judge.id) ?? 0) + 1);
      created += 1;
    }
  }
  await audit({ actorId, action: "auto_assign", entity: "Stage", entityId: stageKey, meta: { created } });
  return { ok: true, data: { created } };
}

export async function setAssignment(actorId: string, judgeId: string, submissionId: string, assigned: boolean): Promise<ActionResult> {
  if (assigned) {
    await prisma.judgeAssignment.upsert({
      where: { judgeId_submissionId: { judgeId, submissionId } },
      create: { judgeId, submissionId, assignedById: actorId },
      update: { conflictDeclared: false },
    });
  } else {
    const row = await prisma.judgeAssignment.findUnique({ where: { judgeId_submissionId: { judgeId, submissionId } }, include: { evaluation: true } });
    if (row?.evaluation?.finalizedAt) return { ok: false, code: "finalized" };
    if (row) await prisma.judgeAssignment.delete({ where: { id: row.id } });
  }
  await audit({ actorId, action: "manual_assign", entity: "Submission", entityId: submissionId, meta: { judgeId, assigned } });
  return { ok: true, data: null };
}

export async function computeRanking(actorId: string, stageKey: StageKey): Promise<ActionResult> {
  const settings = await getSettings();
  const criteria = await prisma.criterion.findMany({ where: { stageKey }, orderBy: { order: "asc" } });
  const submissions = await prisma.submission.findMany({
    where: { stageKey, status: { not: "DRAFT" } },
    include: {
      project: { include: { team: { include: { members: true } } } },
      assignments: { include: { evaluation: { include: { scores: true } } } },
    },
  });
  const rows: { id: string; avg: number; eligible: boolean; needsThird: boolean; snapshot: Prisma.InputJsonValue }[] = [];
  for (const submission of submissions) {
    const finalized = submission.assignments.filter((item) => item.evaluation?.finalizedAt && !item.conflictDeclared);
    const totals: number[] = [];
    const perCriterion = new Map<string, number[]>();
    for (const item of finalized) {
      const scored = scoreSubmission(criteria, item.evaluation?.scores ?? []);
      if (!scored.ok) continue;
      totals.push(scored.total);
      for (const score of item.evaluation?.scores ?? []) {
        const list = perCriterion.get(score.criterionId) ?? [];
        list.push(score.points);
        perCriterion.set(score.criterionId, list);
      }
    }
    if (!totals.length) continue;
    const avg = aggregate(totals, settings.scoreAggregate) ?? 0;
    const eligible = submission.project.team.eligibilityOverride || submission.project.team.members.every((member) => member.verificationStatus === "VERIFIED");
    const strengths: string[] = [];
    const improvements: string[] = [];
    const nextSteps: string[] = [];
    const publicComments: string[] = [];
    for (const item of finalized) {
      for (const value of item.evaluation?.strengths ?? []) if (strengths.length < 3 && !strengths.includes(value)) strengths.push(value);
      for (const value of item.evaluation?.improvements ?? []) if (improvements.length < 3 && !improvements.includes(value)) improvements.push(value);
      if (item.evaluation?.nextSteps) nextSteps.push(item.evaluation.nextSteps);
      if (item.evaluation?.publicComment) publicComments.push(item.evaluation.publicComment);
    }
    rows.push({
      id: submission.id,
      avg,
      eligible,
      needsThird: hasDiscrepancy(totals, settings.discrepancyThreshold),
      snapshot: {
        judgeCount: finalized.length,
        aggregate: settings.scoreAggregate,
        total: avg,
        criteria: criteria.map((criterion) => ({
          key: criterion.key,
          titleUz: criterion.titleUz,
          titleRu: criterion.titleRu,
          titleEn: criterion.titleEn,
          avg: aggregate(perCriterion.get(criterion.id) ?? [], settings.scoreAggregate) ?? 0,
          max: criterion.maxPoints,
        })),
        feedback: { strengths, improvements, nextSteps, publicComments },
      },
    });
  }
  const ranked = rankByAverage(rows.map((row) => ({ id: row.id, avg: row.avg })));
  const eligibleRanked = rankByAverage(rows.filter((row) => row.eligible).map((row) => ({ id: row.id, avg: row.avg })));
  const topN = stageKey === "STAGE1" ? 20 : 12;
  const tied = new Set(boundaryTieIds(eligibleRanked, topN));
  for (const row of rows) {
    const rank = ranked.find((item) => item.id === row.id)?.rank ?? rows.length;
    await prisma.stageResult.upsert({
      where: { submissionId_stageKey: { submissionId: row.id, stageKey } },
      create: {
        submissionId: row.id,
        stageKey,
        avgTotal: row.avg,
        rank,
        advanced: false,
        needsThirdJudge: row.needsThird,
        tieUnresolved: tied.has(row.id),
        snapshot: row.snapshot,
      },
      update: {
        avgTotal: row.avg,
        rank,
        advanced: false,
        needsThirdJudge: row.needsThird,
        tieBreakNote: null,
        tieUnresolved: tied.has(row.id),
        snapshot: row.snapshot,
        computedAt: new Date(),
      },
    });
  }
  await audit({ actorId, action: "compute_ranking", entity: "Stage", entityId: stageKey, meta: { count: rows.length } });
  return { ok: true, data: null };
}

export async function resolveTie(actorId: string, resultId: string, advanced: boolean, note: string): Promise<ActionResult> {
  if (!note.trim()) return { ok: false, code: "tie_note_required" };
  await prisma.stageResult.update({
    where: { id: resultId },
    data: { advanced, tieBreakNote: note.trim().slice(0, 1000), tieUnresolved: false },
  });
  await audit({ actorId, action: "resolve_tie", entity: "StageResult", entityId: resultId, meta: { advanced } });
  return { ok: true, data: null };
}

export async function selectTop(actorId: string, stageKey: StageKey, acknowledgeDiscrepancy: boolean): Promise<ActionResult> {
  const results = await prisma.stageResult.findMany({
    where: { stageKey },
    include: { submission: { include: { project: { include: { team: { include: { members: true } } } } } } },
  });
  if (!results.length) return { ok: false, code: "not_computed" };
  if (results.some((result) => result.tieUnresolved)) return { ok: false, code: "tie_unresolved" };
  if (results.some((result) => result.needsThirdJudge) && !acknowledgeDiscrepancy) return { ok: false, code: "discrepancy_unacknowledged" };
  const topN = stageKey === "STAGE1" ? 20 : 12;
  const eligible = (result: (typeof results)[number]) => result.submission.project.team.eligibilityOverride || result.submission.project.team.members.every((member) => member.verificationStatus === "VERIFIED");
  const reserved = results.filter((result) => result.tieBreakNote && result.advanced).length;
  const pool = results.filter((result) => eligible(result) && !result.tieBreakNote);
  const ranked = rankByAverage(pool.map((result) => ({ id: result.id, avg: result.avgTotal })));
  const chosen = new Set(ranked.filter((row) => row.rank <= Math.max(0, topN - reserved)).map((row) => row.id));
  for (const result of results) {
    await prisma.stageResult.update({
      where: { id: result.id },
      data: { advanced: result.tieBreakNote ? result.advanced : chosen.has(result.id) },
    });
  }
  await audit({ actorId, action: "select_top", entity: "Stage", entityId: stageKey, meta: { topN } });
  return { ok: true, data: null };
}

export async function publishStage(actorId: string, stageKey: StageKey, confirmIfNone = false): Promise<ActionResult> {
  const stage = await prisma.stage.findUnique({ where: { key: stageKey } });
  if (!stage || stage.status !== "EVALUATING") return { ok: false, code: "invalid_transition" };
  const results = await prisma.stageResult.findMany({
    where: { stageKey },
    include: { submission: { include: { project: { include: { team: true } } } } },
  });
  if (!results.length) return { ok: false, code: "not_computed" };
  if (results.some((result) => result.tieUnresolved)) return { ok: false, code: "tie_unresolved" };
  if (!results.some((result) => result.advanced) && !confirmIfNone) return { ok: false, code: "none_advanced" };
  await prisma.stage.update({ where: { id: stage.id }, data: { status: "PUBLISHED", resultsPublishedAt: new Date() } });
  for (const result of results) {
    await notifyUser({
      userId: result.submission.project.team.leaderId,
      type: "published",
      titleKey: "published",
      payload: { stage: stageKey, advanced: result.advanced, project: result.submission.project.title },
    });
  }
  await audit({ actorId, action: "publish_results", entity: "Stage", entityId: stage.id });
  return { ok: true, data: null };
}

export async function revealScores(actorId: string, stageKey: StageKey, value: boolean): Promise<ActionResult> {
  const stage = await prisma.stage.update({ where: { key: stageKey }, data: { revealScoresToJudges: value } });
  await audit({ actorId, action: "reveal_scores", entity: "Stage", entityId: stage.id, meta: { value } });
  return { ok: true, data: null };
}

export async function reopenEvaluation(actorId: string, assignmentId: string): Promise<ActionResult> {
  await prisma.evaluation.update({ where: { assignmentId }, data: { finalizedAt: null } });
  await prisma.judgeAssignment.update({ where: { id: assignmentId }, data: { status: "IN_PROGRESS" } });
  await audit({ actorId, action: "reopen_evaluation", entity: "JudgeAssignment", entityId: assignmentId });
  return { ok: true, data: null };
}

export async function adminUnlockSubmission(actorId: string, submissionId: string, reason: string): Promise<ActionResult> {
  if (reason.trim().length < 8) return { ok: false, code: "reason_required" };
  await prisma.submission.update({
    where: { id: submissionId },
    data: { status: "SUBMITTED", updateUsedAt: null },
  });
  await audit({ actorId, action: "admin_unlock_submission", entity: "Submission", entityId: submissionId, meta: { reason: reason.trim() } });
  return { ok: true, data: null };
}

export async function savePlatformSettings(actorId: string, value: PlatformSettings): Promise<ActionResult> {
  await saveSettings(value);
  await audit({ actorId, action: "save_settings", entity: "AppSetting", entityId: "platform" });
  return { ok: true, data: null };
}

export async function saveContent(actorId: string, key: string, value: ContentSection[] | FaqItem[] | Prisma.InputJsonValue): Promise<ActionResult> {
  await prisma.appSetting.upsert({ where: { key }, create: { key, value: value as Prisma.InputJsonValue }, update: { value: value as Prisma.InputJsonValue } });
  await audit({ actorId, action: "save_content", entity: "AppSetting", entityId: key });
  return { ok: true, data: null };
}

export async function saveFaculty(actorId: string, input: { id?: string; nameUz: string; nameRu: string; nameEn: string; isActive: boolean }): Promise<ActionResult> {
  if ([input.nameUz, input.nameRu, input.nameEn].some((name) => name.trim().length < 2)) return { ok: false, code: "invalid_input" };
  const data = { nameUz: input.nameUz.trim(), nameRu: input.nameRu.trim(), nameEn: input.nameEn.trim(), isActive: input.isActive };
  const faculty = input.id
    ? await prisma.faculty.update({ where: { id: input.id }, data })
    : await prisma.faculty.create({ data });
  await audit({ actorId, action: "save_faculty", entity: "Faculty", entityId: faculty.id });
  return { ok: true, data: null };
}

export async function saveTrack(actorId: string, input: { id?: string; slug: string; nameUz: string; nameRu: string; nameEn: string; descUz: string; descRu: string; descEn: string; isActive: boolean }): Promise<ActionResult> {
  if (!/^[a-z0-9-]{2,40}$/.test(input.slug)) return { ok: false, code: "invalid_input" };
  const data = {
    slug: input.slug,
    nameUz: input.nameUz.trim(),
    nameRu: input.nameRu.trim(),
    nameEn: input.nameEn.trim(),
    descUz: input.descUz.trim(),
    descRu: input.descRu.trim(),
    descEn: input.descEn.trim(),
    isActive: input.isActive,
  };
  const track = input.id ? await prisma.track.update({ where: { id: input.id }, data }) : await prisma.track.create({ data });
  await audit({ actorId, action: "save_track", entity: "Track", entityId: track.id });
  return { ok: true, data: null };
}

export async function saveAnnouncement(actorId: string, input: { id?: string; titleUz: string; titleRu: string; titleEn: string; bodyUz: string; bodyRu: string; bodyEn: string; publish: boolean }): Promise<ActionResult> {
  const data = {
    titleUz: input.titleUz.trim(),
    titleRu: input.titleRu.trim(),
    titleEn: input.titleEn.trim(),
    bodyUz: input.bodyUz.trim(),
    bodyRu: input.bodyRu.trim(),
    bodyEn: input.bodyEn.trim(),
    publishedAt: input.publish ? new Date() : null,
  };
  if (Object.values(data).some((value) => typeof value === "string" && value.length < 2)) return { ok: false, code: "invalid_input" };
  const row = input.id ? await prisma.announcement.update({ where: { id: input.id }, data }) : await prisma.announcement.create({ data });
  await audit({ actorId, action: "save_announcement", entity: "Announcement", entityId: row.id });
  return { ok: true, data: null };
}

export async function sendDeadlineReminders(actorId: string): Promise<ActionResult<{ sent: number }>> {
  const now = new Date();
  const soon = new Date(now.getTime() + 1000 * 60 * 60 * 48);
  const stages = await prisma.stage.findMany({ where: { status: "OPEN", deadlineAt: { gt: now, lte: soon } } });
  let sent = 0;
  for (const stage of stages) {
    const drafts = await prisma.submission.findMany({
      where: { stageKey: stage.key, status: "DRAFT" },
      include: { project: { include: { team: true } } },
    });
    for (const draft of drafts) {
      const already = await prisma.notification.findFirst({
        where: { userId: draft.project.team.leaderId, type: "reminder", createdAt: { gt: new Date(now.getTime() - 1000 * 60 * 60 * 20) } },
      });
      if (already) continue;
      await notifyUser({
        userId: draft.project.team.leaderId,
        type: "reminder",
        titleKey: "reminder",
        payload: { stage: stage.key },
      });
      sent += 1;
    }
  }
  await audit({ actorId, action: "deadline_reminders", entity: "Notification", meta: { sent } });
  return { ok: true, data: { sent } };
}

export { verificationFor };
