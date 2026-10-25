"use server";

import { Prisma, type Role, type StageKey, type StageStatus } from "@prisma/client";
import argon2 from "argon2";
import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { advanceSelection, averageCriteria, planRanking } from "@/lib/ranking";
import { toPublicFeedback } from "@/lib/files-access";
import { notifyUser } from "@/lib/notify";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/session";
import { getSettings, saveSettings, type PlatformSettings } from "@/lib/settings";
import { deleteObject, newStorageKey, putObject, randomPassword } from "@/lib/storage";
import { extensionAllowed, matchesKind } from "@/lib/file-magic";
import { scanFile } from "@/lib/virus-scan";
import { normalizeGroup } from "@/lib/utils";
import { stageDatesSchema } from "@/lib/validation";
import { tashkentInputToUtc } from "@/lib/time";
import { checked, localeOf, text, type ActionState } from "@/server/action-state";
import { saveContent, type FaqItem, type SiteContent } from "@/server/content";

const transitions: Record<StageStatus, StageStatus[]> = {
  DRAFT: ["OPEN"],
  OPEN: ["CLOSED", "EVALUATING"],
  CLOSED: ["OPEN", "EVALUATING"],
  EVALUATING: ["CLOSED"],
  PUBLISHED: [],
};

function refresh(locale: string) {
  revalidatePath(`/${locale}/admin`, "layout");
  revalidatePath(`/${locale}`, "layout");
}

export async function updateStage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = localeOf(formData);
  const admin = await requireRoles(locale, ["ADMIN"]);
  if (!checked(formData, "confirm")) return { error: "confirm_required" };
  const key = text(formData, "key") as StageKey;
  const stage = await prisma.stage.findUnique({ where: { key } });
  if (!stage || stage.status === "PUBLISHED") return { error: "invalid_status" };
  const dates = stageDatesSchema.safeParse({
    opensAt: text(formData, "opensAt"),
    updateDeadlineAt: text(formData, "updateDeadlineAt"),
    deadlineAt: text(formData, "deadlineAt"),
  });
  if (!dates.success) return { error: "dates_invalid", field: "updateDeadlineAt" };
  const nextStatus = text(formData, "status") as StageStatus;
  if (nextStatus !== stage.status && !transitions[stage.status].includes(nextStatus)) return { error: "invalid_status" };
  await prisma.stage.update({
    where: { id: stage.id },
    data: {
      opensAt: tashkentInputToUtc(dates.data.opensAt),
      updateDeadlineAt: tashkentInputToUtc(dates.data.updateDeadlineAt),
      deadlineAt: tashkentInputToUtc(dates.data.deadlineAt),
      status: nextStatus,
    },
  });
  await audit({
    actorId: admin.id,
    action: "stage_updated",
    entity: "Stage",
    entityId: stage.id,
    meta: { from: stage.status, to: nextStatus },
  });
  refresh(locale);
  return { ok: true };
}

export async function createStaff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = localeOf(formData);
  const admin = await requireRoles(locale, ["ADMIN"]);
  const role = text(formData, "role");
  if (role !== "JUDGE" && role !== "ADMIN") return { error: "invalid_field", field: "role" };
  const fullName = text(formData, "fullName").trim();
  const studentId = text(formData, "studentId").trim().toUpperCase();
  if (fullName.length < 3 || !/^[A-Za-z0-9-]{4,32}$/.test(studentId)) return { error: "invalid_field", field: "studentId" };
  const password = randomPassword();
  try {
    const user = await prisma.user.create({
      data: {
        fullName,
        studentId,
        role: role as Role,
        passwordHash: await argon2.hash(password),
        mustChangePassword: true,
        locale,
      },
    });
    await audit({ actorId: admin.id, action: "staff_created", entity: "User", entityId: user.id, meta: { role } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { error: "student_id_taken", field: "studentId" };
    return { error: "generic" };
  }
  refresh(locale);
  return { ok: true, password };
}

export async function resetPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = localeOf(formData);
  const admin = await requireRoles(locale, ["ADMIN"]);
  const user = await prisma.user.findUnique({ where: { id: text(formData, "userId") } });
  if (!user) return { error: "not_found" };
  const password = randomPassword();
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await argon2.hash(password), mustChangePassword: true },
  });
  await audit({ actorId: admin.id, action: "password_reset", entity: "User", entityId: user.id });
  refresh(locale);
  return { ok: true, password };
}

export async function setActive(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = localeOf(formData);
  const admin = await requireRoles(locale, ["ADMIN"]);
  const user = await prisma.user.findUnique({ where: { id: text(formData, "userId") } });
  if (!user) return { error: "not_found" };
  const active = text(formData, "active") === "true";
  if (!active && user.id === admin.id) return { error: "self_deactivate" };
  if (!active && user.role === "ADMIN") {
    const admins = await prisma.user.count({ where: { role: "ADMIN", isActive: true, id: { not: user.id } } });
    if (admins === 0) return { error: "last_admin" };
  }
  await prisma.user.update({ where: { id: user.id }, data: { isActive: active } });
  await audit({ actorId: admin.id, action: active ? "user_activated" : "user_deactivated", entity: "User", entityId: user.id });
  refresh(locale);
  return { ok: true };
}

export async function reviewMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = localeOf(formData);
  const admin = await requireRoles(locale, ["ADMIN"]);
  const member = await prisma.teamMember.findUnique({ where: { id: text(formData, "memberId") }, include: { team: true } });
  if (!member) return { error: "not_found" };
  const decision = text(formData, "decision");
  if (decision !== "VERIFIED" && decision !== "REJECTED") return { error: "invalid_field" };
  const note = text(formData, "note").trim();
  await prisma.teamMember.update({
    where: { id: member.id },
    data: { verificationStatus: decision, rejectionNote: decision === "REJECTED" ? note : null },
  });
  await audit({ actorId: admin.id, action: `member_${decision.toLowerCase()}`, entity: "TeamMember", entityId: member.id });
  await notifyUser({
    userId: member.team.leaderId,
    type: decision === "VERIFIED" ? "verified" : "rejected",
    titleKey: decision === "VERIFIED" ? "notifications.verified" : "notifications.rejected",
    payload: { note },
  });
  refresh(locale);
  return { ok: true };
}

export async function setOverride(formData: FormData) {
  const locale = localeOf(formData);
  const admin = await requireRoles(locale, ["ADMIN"]);
  const team = await prisma.team.update({
    where: { id: text(formData, "teamId") },
    data: { eligibilityOverride: text(formData, "override") === "true" },
  });
  await audit({ actorId: admin.id, action: "eligibility_override", entity: "Team", entityId: team.id, meta: { value: team.eligibilityOverride } });
  refresh(locale);
}

export async function importRoster(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = localeOf(formData);
  const admin = await requireRoles(locale, ["ADMIN"]);
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "file_type" };
  const lines = (await file.text()).replace(/^\uFEFF/, "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return { error: "roster_empty" };
  const header = lines[0]!.split(",").map((cell) => cell.trim().toLowerCase());
  const index = {
    studentId: header.indexOf("studentid"),
    fullName: header.indexOf("fullname"),
    faculty: header.indexOf("faculty"),
    group: header.indexOf("group"),
  };
  if (Object.values(index).some((value) => value < 0)) return { error: "roster_empty" };
  const faculties = await prisma.faculty.findMany();
  let imported = 0;
  const skipped: string[] = [];
  for (const line of lines.slice(1)) {
    const cells = line.split(",").map((cell) => cell.trim());
    const studentId = (cells[index.studentId] ?? "").toUpperCase();
    const fullName = cells[index.fullName] ?? "";
    const facultyName = (cells[index.faculty] ?? "").toLowerCase();
    const groupName = cells[index.group] ?? "";
    const faculty = faculties.find((item) => [item.nameUz, item.nameRu, item.nameEn].some((name) => name.toLowerCase() === facultyName));
    if (!/^[A-Z0-9-]{4,32}$/.test(studentId) || fullName.length < 3 || !faculty || groupName.length < 2) {
      skipped.push(studentId || line.slice(0, 40));
      continue;
    }
    await prisma.rosterEntry.upsert({
      where: { studentId },
      create: { studentId, fullName, facultyId: faculty.id, groupName },
      update: { fullName, facultyId: faculty.id, groupName },
    });
    const members = await prisma.teamMember.findMany({ where: { studentId } });
    for (const member of members) {
      const matches = member.facultyId === faculty.id && normalizeGroup(member.groupName) === normalizeGroup(groupName);
      if (matches && member.verificationStatus !== "VERIFIED") {
        await prisma.teamMember.update({ where: { id: member.id }, data: { verificationStatus: "VERIFIED" } });
      }
    }
    imported += 1;
  }
  await audit({ actorId: admin.id, action: "roster_imported", entity: "RosterEntry", meta: { imported, skipped: skipped.length } });
  refresh(locale);
  return { ok: true, imported, skipped };
}

async function rankingRows(stageKey: StageKey) {
  const stage = await prisma.stage.findUnique({ where: { key: stageKey }, include: { criteria: { orderBy: { order: "asc" } } } });
  if (!stage) return null;
  const settings = await getSettings();
  const submissions = await prisma.submission.findMany({
    where: { stageKey, status: { not: "DRAFT" } },
    include: {
      project: { include: { team: { include: { members: true } }, track: true } },
      assignments: { include: { evaluation: { include: { scores: true } }, judge: true } },
      results: true,
    },
  });
  const rows = submissions.map((submission) => {
    const finalized = submission.assignments.filter((item) => item.evaluation?.finalizedAt && !item.conflictDeclared);
    return {
      submission,
      totals: finalized.map((item) => item.evaluation!.scores.reduce((sum, score) => sum + score.points, 0)),
      finalized,
      eligible: submission.project.team.eligibilityOverride || submission.project.team.members.every((member) => member.verificationStatus === "VERIFIED"),
    };
  });
  const plan = planRanking({
    rows: rows.map((row) => ({ id: row.submission.id, totals: row.totals })),
    threshold: settings.discrepancyThreshold,
    mode: settings.scoreAggregate,
    judgesExpected: settings.judgesPerSubmission,
    topN: stageKey === "STAGE2" ? 12 : 20,
  });
  return { stage, settings, rows, plan };
}

export async function computeRanking(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = localeOf(formData);
  const admin = await requireRoles(locale, ["ADMIN"]);
  const key = text(formData, "key") as StageKey;
  const packed = await rankingRows(key);
  if (!packed) return { error: "not_found" };
  for (const row of packed.plan) {
    const source = packed.rows.find((item) => item.submission.id === row.id);
    if (!source) continue;
    const snapshot = {
      criteria: averageCriteria(
        packed.stage.criteria,
        source.finalized.map((item) => ({ points: item.evaluation!.scores })),
        packed.settings.scoreAggregate,
      ).map((score) => {
        const criterion = packed.stage.criteria.find((item) => item.id === score.criterionId)!;
        return {
          id: criterion.id,
          key: criterion.key,
          avg: score.avg,
          max: criterion.maxPoints,
          titleUz: criterion.titleUz,
          titleRu: criterion.titleRu,
          titleEn: criterion.titleEn,
        };
      }),
      feedback: toPublicFeedback(source.finalized.map((item) => item.evaluation!)),
    };
    await prisma.stageResult.upsert({
      where: { submissionId_stageKey: { submissionId: row.id, stageKey: key } },
      create: {
        submissionId: row.id,
        stageKey: key,
        avgTotal: row.avg,
        rank: row.rank,
        advanced: false,
        needsThirdJudge: row.needsThirdJudge,
        tieUnresolved: row.tie,
        snapshot,
      },
      update: {
        avgTotal: row.avg,
        rank: row.rank,
        advanced: false,
        needsThirdJudge: row.needsThirdJudge,
        tieUnresolved: row.tie,
        snapshot,
        computedAt: new Date(),
      },
    });
  }
  await audit({ actorId: admin.id, action: "ranking_computed", entity: "Stage", entityId: packed.stage.id });
  refresh(locale);
  return { ok: true };
}

export async function selectWinners(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = localeOf(formData);
  const admin = await requireRoles(locale, ["ADMIN"]);
  if (!checked(formData, "confirm")) return { error: "confirm_required" };
  const key = text(formData, "key") as StageKey;
  const topN = Number(text(formData, "topN"));
  if (!Number.isInteger(topN) || topN < 1 || topN > 100) return { error: "invalid_field", field: "topN" };
  const packed = await rankingRows(key);
  if (!packed) return { error: "not_found" };
  const note = text(formData, "tieNote").trim();
  const chosen = formData.getAll("tie").filter((value): value is string => typeof value === "string");
  const plan = planRanking({
    rows: packed.rows.map((row) => ({ id: row.submission.id, totals: row.totals })),
    threshold: packed.settings.discrepancyThreshold,
    mode: packed.settings.scoreAggregate,
    judgesExpected: packed.settings.judgesPerSubmission,
    topN,
  });
  if (plan.some((row) => row.tie) && note.length < 3) return { error: "tie_unresolved", field: "tieNote" };
  const selection = advanceSelection(plan, topN, chosen);
  if (!selection.ok) return { error: "tie_unresolved" };
  const blocked = packed.rows.filter((row) => selection.advanced.has(row.submission.id) && !row.eligible);
  if (blocked.length > 0) return { error: "not_eligible" };
  const stored = await prisma.stageResult.findMany({ where: { stageKey: key }, select: { submissionId: true } });
  const storedIds = new Set(stored.map((row) => row.submissionId));
  if (plan.some((row) => !storedIds.has(row.id))) return { error: "select_first" };
  for (const row of plan) {
    await prisma.stageResult.update({
      where: { submissionId_stageKey: { submissionId: row.id, stageKey: key } },
      data: {
        advanced: selection.advanced.has(row.id),
        tieUnresolved: false,
        tieBreakNote: row.tie ? note : null,
      },
    });
  }
  await audit({ actorId: admin.id, action: "ranking_selected", entity: "Stage", entityId: packed.stage.id, meta: { topN } });
  refresh(locale);
  return { ok: true };
}

export async function publishResults(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = localeOf(formData);
  const admin = await requireRoles(locale, ["ADMIN"]);
  if (!checked(formData, "confirm")) return { error: "confirm_required" };
  const key = text(formData, "key") as StageKey;
  const stage = await prisma.stage.findUnique({ where: { key } });
  if (!stage || (stage.status !== "EVALUATING" && stage.status !== "CLOSED")) return { error: "invalid_status" };
  const [computed, selected, unresolved] = await Promise.all([
    prisma.auditLog.findFirst({ where: { action: "ranking_computed", entityId: stage.id }, orderBy: { createdAt: "desc" } }),
    prisma.auditLog.findFirst({ where: { action: "ranking_selected", entityId: stage.id }, orderBy: { createdAt: "desc" } }),
    prisma.stageResult.count({ where: { stageKey: key, tieUnresolved: true } }),
  ]);
  if (!computed || !selected || selected.createdAt < computed.createdAt) return { error: "select_first" };
  if (unresolved > 0) return { error: "tie_unresolved" };
  await prisma.stage.update({ where: { id: stage.id }, data: { status: "PUBLISHED", resultsPublishedAt: new Date() } });
  const results = await prisma.stageResult.findMany({
    where: { stageKey: key },
    include: { submission: { include: { project: true } } },
  });
  const leaders = await prisma.team.findMany({
    where: { project: { submissions: { some: { stageKey: key, status: { not: "DRAFT" } } } } },
    select: { leaderId: true },
  });
  for (const leader of leaders) {
    await notifyUser({ userId: leader.leaderId, type: "published", titleKey: "notifications.published", payload: { stage: key } });
  }
  await audit({ actorId: admin.id, action: "results_published", entity: "Stage", entityId: stage.id, meta: { results: results.length } });
  refresh(locale);
  return { ok: true };
}

export async function autoAssign(formData: FormData) {
  const locale = localeOf(formData);
  const admin = await requireRoles(locale, ["ADMIN"]);
  const key = text(formData, "key") as StageKey;
  const settings = await getSettings();
  const judges = await prisma.user.findMany({ where: { role: "JUDGE", isActive: true } });
  const submissions = await prisma.submission.findMany({
    where: { stageKey: key, status: { not: "DRAFT" } },
    include: { assignments: true },
  });
  const load = new Map(judges.map((judge) => [judge.id, 0]));
  for (const submission of submissions) {
    for (const assignment of submission.assignments) {
      if (!assignment.conflictDeclared) load.set(assignment.judgeId, (load.get(assignment.judgeId) ?? 0) + 1);
    }
  }
  for (const submission of submissions) {
    let need = settings.judgesPerSubmission - submission.assignments.filter((item) => !item.conflictDeclared).length;
    const busy = new Set(submission.assignments.map((item) => item.judgeId));
    const candidates = [...judges].filter((judge) => !busy.has(judge.id)).sort((a, b) => (load.get(a.id) ?? 0) - (load.get(b.id) ?? 0));
    for (const judge of candidates) {
      if (need <= 0) break;
      await prisma.judgeAssignment.create({ data: { judgeId: judge.id, submissionId: submission.id, assignedById: admin.id } });
      load.set(judge.id, (load.get(judge.id) ?? 0) + 1);
      need -= 1;
    }
  }
  await audit({ actorId: admin.id, action: "auto_assigned", entity: "Stage", entityId: key });
  refresh(locale);
}

export async function manualAssign(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = localeOf(formData);
  const admin = await requireRoles(locale, ["ADMIN"]);
  const judgeId = text(formData, "judgeId");
  const submissionId = text(formData, "submissionId");
  const judge = await prisma.user.findFirst({ where: { id: judgeId, role: "JUDGE", isActive: true } });
  const submission = await prisma.submission.findUnique({ where: { id: submissionId } });
  if (!judge || !submission || submission.status === "DRAFT") return { error: "not_found" };
  const existing = await prisma.judgeAssignment.findUnique({ where: { judgeId_submissionId: { judgeId, submissionId } } });
  if (existing?.conflictDeclared) return { error: "forbidden" };
  if (!existing) {
    await prisma.judgeAssignment.create({ data: { judgeId, submissionId, assignedById: admin.id } });
  }
  await audit({ actorId: admin.id, action: "manual_assigned", entity: "Submission", entityId: submissionId, meta: { judgeId } });
  refresh(locale);
  return { ok: true };
}

export async function reopenEvaluation(formData: FormData) {
  const locale = localeOf(formData);
  const admin = await requireRoles(locale, ["ADMIN"]);
  const evaluation = await prisma.evaluation.findUnique({ where: { id: text(formData, "evaluationId") } });
  if (!evaluation) return;
  await prisma.evaluation.update({ where: { id: evaluation.id }, data: { finalizedAt: null } });
  await prisma.judgeAssignment.update({ where: { id: evaluation.assignmentId }, data: { status: "IN_PROGRESS" } });
  await audit({ actorId: admin.id, action: "evaluation_reopened", entity: "Evaluation", entityId: evaluation.id });
  refresh(locale);
}

export async function savePlatformSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = localeOf(formData);
  const admin = await requireRoles(locale, ["ADMIN"]);
  const current = await getSettings();
  const next: PlatformSettings = {
    ...current,
    discrepancyThreshold: numberIn(text(formData, "discrepancyThreshold"), 1, 100, current.discrepancyThreshold),
    judgesPerSubmission: numberIn(text(formData, "judgesPerSubmission"), 1, 5, current.judgesPerSubmission),
    scoreAggregate: text(formData, "scoreAggregate") === "median" ? "median" : "average",
    judgesCanScoreAny: checked(formData, "judgesCanScoreAny"),
    blindReview: checked(formData, "blindReview"),
    emailPasswordReset: checked(formData, "emailPasswordReset"),
    videoUploadEnabled: checked(formData, "videoUploadEnabled"),
    contactEmail: text(formData, "contactEmail").trim(),
    appealDays: numberIn(text(formData, "appealDays"), 0, 30, current.appealDays),
    maxFileMb: {
      PRD_PDF: numberIn(text(formData, "PRD_PDF"), 1, 200, current.maxFileMb.PRD_PDF),
      PITCH_DECK: numberIn(text(formData, "PITCH_DECK"), 1, 200, current.maxFileMb.PITCH_DECK),
      VIDEO_FILE: numberIn(text(formData, "VIDEO_FILE"), 1, 500, current.maxFileMb.VIDEO_FILE),
      EQUIVALENT_PROOF: numberIn(text(formData, "EQUIVALENT_PROOF"), 1, 200, current.maxFileMb.EQUIVALENT_PROOF),
      OTHER: numberIn(text(formData, "OTHER"), 1, 200, current.maxFileMb.OTHER),
    },
  };
  if (next.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.contactEmail)) return { error: "invalid_field", field: "contactEmail" };
  await saveSettings(next);
  await audit({ actorId: admin.id, action: "settings_saved", entity: "AppSetting", entityId: "platform" });
  refresh(locale);
  return { ok: true };
}

function numberIn(value: string, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return fallback;
  return parsed;
}

export async function saveSiteContent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = localeOf(formData);
  const admin = await requireRoles(locale, ["ADMIN"]);
  const faq: FaqItem[] = [];
  for (let index = 0; index < 12; index += 1) {
    const item = {
      qUz: text(formData, `qUz_${index}`).trim(),
      qRu: text(formData, `qRu_${index}`).trim(),
      qEn: text(formData, `qEn_${index}`).trim(),
      aUz: text(formData, `aUz_${index}`).trim(),
      aRu: text(formData, `aRu_${index}`).trim(),
      aEn: text(formData, `aEn_${index}`).trim(),
    };
    if (item.qUz || item.qRu || item.qEn) faq.push(item);
  }
  const content: SiteContent = {
    regulation: { uz: text(formData, "regUz"), ru: text(formData, "regRu"), en: text(formData, "regEn") },
    faq,
  };
  await saveContent(content);
  const tracks = await prisma.track.findMany();
  for (const track of tracks) {
    await prisma.track.update({
      where: { id: track.id },
      data: {
        nameUz: text(formData, `track_${track.id}_uz`) || track.nameUz,
        nameRu: text(formData, `track_${track.id}_ru`) || track.nameRu,
        nameEn: text(formData, `track_${track.id}_en`) || track.nameEn,
        descUz: text(formData, `track_${track.id}_duz`),
        descRu: text(formData, `track_${track.id}_dru`),
        descEn: text(formData, `track_${track.id}_den`),
        isActive: checked(formData, `track_${track.id}_active`),
      },
    });
  }
  const faculties = await prisma.faculty.findMany();
  for (const faculty of faculties) {
    await prisma.faculty.update({
      where: { id: faculty.id },
      data: {
        nameUz: text(formData, `faculty_${faculty.id}_uz`) || faculty.nameUz,
        nameRu: text(formData, `faculty_${faculty.id}_ru`) || faculty.nameRu,
        nameEn: text(formData, `faculty_${faculty.id}_en`) || faculty.nameEn,
        isActive: checked(formData, `faculty_${faculty.id}_active`),
      },
    });
  }
  await audit({ actorId: admin.id, action: "content_saved", entity: "AppSetting", entityId: "content" });
  refresh(locale);
  return { ok: true };
}

export async function addAnnouncement(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = localeOf(formData);
  const admin = await requireRoles(locale, ["ADMIN"]);
  const titleUz = text(formData, "titleUz").trim();
  const titleRu = text(formData, "titleRu").trim();
  const titleEn = text(formData, "titleEn").trim();
  if (!titleUz || !titleRu || !titleEn) return { error: "invalid_field", field: "titleUz" };
  const row = await prisma.announcement.create({
    data: {
      titleUz,
      titleRu,
      titleEn,
      bodyUz: text(formData, "bodyUz"),
      bodyRu: text(formData, "bodyRu"),
      bodyEn: text(formData, "bodyEn"),
      publishedAt: checked(formData, "publish") ? new Date() : null,
    },
  });
  await audit({ actorId: admin.id, action: "announcement_created", entity: "Announcement", entityId: row.id });
  refresh(locale);
  return { ok: true };
}

export async function uploadTemplate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = localeOf(formData);
  const admin = await requireRoles(locale, ["ADMIN"]);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size <= 0) return { error: "file_type" };
  if (!extensionAllowed("PRD_PDF", file.name)) return { error: "file_type" };
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!(await matchesKind("PRD_PDF", file.type || "application/pdf", buffer))) return { error: "file_type" };
  const scan = await scanFile(buffer);
  if (!scan.clean) return { error: "file_scan" };
  const settings = await getSettings();
  if (file.size > settings.maxFileMb.PRD_PDF * 1024 * 1024) return { error: "file_size" };
  const key = newStorageKey("templates");
  await putObject(key, buffer, "application/pdf");
  const previous = await prisma.appSetting.findUnique({ where: { key: "prdTemplate" } });
  await prisma.appSetting.upsert({
    where: { key: "prdTemplate" },
    create: { key: "prdTemplate", value: { storageKey: key, originalName: file.name, mime: "application/pdf", size: file.size } },
    update: { value: { storageKey: key, originalName: file.name, mime: "application/pdf", size: file.size } },
  });
  const oldKey = previous && typeof previous.value === "object" && previous.value && "storageKey" in previous.value ? String(previous.value.storageKey) : "";
  if (oldKey) await deleteObject(oldKey).catch(() => undefined);
  await audit({ actorId: admin.id, action: "template_uploaded", entity: "AppSetting", entityId: "prdTemplate" });
  refresh(locale);
  return { ok: true };
}
