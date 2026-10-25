import argon2 from "argon2";
import { createHash } from "node:crypto";
import { Prisma, type FileKind, type LinkKind, type StageKey } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { rateLimit } from "@/lib/rate-limit";
import { getSettings } from "@/lib/settings";
import { normalizeGroup, safeHttpUrl } from "@/lib/utils";
import { evaluateWrite, interpretSubmit } from "@/lib/deadlines";
import { readStage1, readStage2 } from "@/lib/payload";
import { CHECKLIST_KEYS } from "@/lib/catalog";
import { memberSchema, registerSchema, stage1DraftSchema, stage1Schema, stage2Schema } from "@/lib/validation";
import type { Stage1Draft, Stage2Input } from "@/lib/validation";

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; code: string; field?: string };

function uniqueCode(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function verificationFor(studentId: string, facultyId: string, groupName: string) {
  const entry = await prisma.rosterEntry.findUnique({ where: { studentId } });
  if (!entry) return "PENDING" as const;
  if (entry.facultyId === facultyId && normalizeGroup(entry.groupName) === normalizeGroup(groupName)) return "VERIFIED" as const;
  return "PENDING" as const;
}

export async function teamIsEligible(teamId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { members: true },
  });
  if (!team) return false;
  if (team.eligibilityOverride) return true;
  return team.members.length > 0 && team.members.every((member) => member.verificationStatus === "VERIFIED");
}

async function stageByKey(key: StageKey) {
  return prisma.stage.findUnique({ where: { key } });
}

async function leaderContext(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      ledTeam: {
        include: {
          members: { include: { faculty: true }, orderBy: { createdAt: "asc" } },
          project: { include: { track: true, submissions: { include: { files: true, links: true } } } },
        },
      },
    },
  });
}

export async function registerParticipant(raw: unknown, ip: string): Promise<ActionResult<{ eligible: boolean }>> {
  if (!rateLimit(`register:${ip}`).ok) return { ok: false, code: "rate_limited" };
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, code: issue?.message === "phone_or_telegram" ? "phone_or_telegram" : "invalid_input", field: issue?.path[0]?.toString() };
  }
  const input = parsed.data;
  const faculty = await prisma.faculty.findFirst({ where: { id: input.facultyId, isActive: true } });
  if (!faculty) return { ok: false, code: "invalid_input", field: "facultyId" };
  const track = await prisma.track.findFirst({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
  if (!track) return { ok: false, code: "tracks_missing" };
  const status = await verificationFor(input.studentId, input.facultyId, input.groupName);
  const passwordHash = await argon2.hash(input.password);
  try {
    const user = await prisma.user.create({
      data: {
        studentId: input.studentId,
        fullName: input.fullName,
        role: "PARTICIPANT",
        passwordHash,
        phone: input.phone || null,
        telegram: input.telegram || null,
        email: input.email || null,
        facultyId: input.facultyId,
        course: input.course,
        groupName: input.groupName,
        ledTeam: {
          create: {
            members: {
              create: {
                fullName: input.fullName,
                studentId: input.studentId,
                facultyId: input.facultyId,
                course: input.course,
                groupName: input.groupName,
                verificationStatus: status,
                isLeader: true,
              },
            },
            project: {
              create: {
                trackId: track.id,
                title: "",
                submissions: { create: { stageKey: "STAGE1", status: "DRAFT", payload: {} } },
              },
            },
          },
        },
      },
    });
    await notifyUser({ userId: user.id, type: "registered", titleKey: "registered", payload: {} });
    await audit({ actorId: user.id, action: "register", entity: "User", entityId: user.id });
    return { ok: true, data: { eligible: status === "VERIFIED" } };
  } catch (error) {
    if (uniqueCode(error)) return { ok: false, code: "student_id_taken", field: "studentId" };
    throw error;
  }
}

async function assertMemberWindow() {
  const stage = await stageByKey("STAGE1");
  if (!stage) return { ok: false as const, code: "not_found" };
  const now = new Date();
  if ((stage.status !== "OPEN" && stage.status !== "DRAFT") || now > stage.deadlineAt) {
    return { ok: false as const, code: "members_locked" };
  }
  return { ok: true as const, stage };
}

export async function saveTeamName(userId: string, name: string): Promise<ActionResult> {
  const window = await assertMemberWindow();
  if (!window.ok) return window;
  const team = await prisma.team.findUnique({ where: { leaderId: userId } });
  if (!team) return { ok: false, code: "not_found" };
  await prisma.team.update({ where: { id: team.id }, data: { name: name.trim().slice(0, 80) || null } });
  return { ok: true, data: null };
}

export async function addMember(userId: string, raw: unknown): Promise<ActionResult> {
  const window = await assertMemberWindow();
  if (!window.ok) return window;
  const parsed = memberSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, code: "invalid_input" };
  const team = await prisma.team.findUnique({ where: { leaderId: userId }, include: { members: true } });
  if (!team) return { ok: false, code: "not_found" };
  if (team.members.length >= 4) return { ok: false, code: "team_full" };
  const faculty = await prisma.faculty.findFirst({ where: { id: parsed.data.facultyId, isActive: true } });
  if (!faculty) return { ok: false, code: "invalid_input", field: "facultyId" };
  const existingUser = await prisma.user.findUnique({ where: { studentId: parsed.data.studentId } });
  if (existingUser) return { ok: false, code: "student_id_taken", field: "studentId" };
  const status = await verificationFor(parsed.data.studentId, parsed.data.facultyId, parsed.data.groupName);
  try {
    await prisma.teamMember.create({
      data: { teamId: team.id, ...parsed.data, verificationStatus: status, isLeader: false },
    });
  } catch (error) {
    if (uniqueCode(error)) return { ok: false, code: "student_id_taken", field: "studentId" };
    throw error;
  }
  return { ok: true, data: null };
}

export async function updateMember(userId: string, memberId: string, raw: unknown): Promise<ActionResult> {
  const window = await assertMemberWindow();
  if (!window.ok) return window;
  const parsed = memberSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, code: "invalid_input" };
  const member = await prisma.teamMember.findFirst({ where: { id: memberId, team: { leaderId: userId } } });
  if (!member) return { ok: false, code: "not_found" };
  if (!member.isLeader) {
    const existingUser = await prisma.user.findUnique({ where: { studentId: parsed.data.studentId } });
    if (existingUser) return { ok: false, code: "student_id_taken", field: "studentId" };
  }
  const status = member.verificationStatus === "REJECTED"
    ? "PENDING"
    : await verificationFor(parsed.data.studentId, parsed.data.facultyId, parsed.data.groupName);
  try {
    await prisma.teamMember.update({
      where: { id: member.id },
      data: { ...parsed.data, verificationStatus: status, rejectionNote: null },
    });
  } catch (error) {
    if (uniqueCode(error)) return { ok: false, code: "student_id_taken", field: "studentId" };
    throw error;
  }
  if (member.isLeader) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        fullName: parsed.data.fullName,
        studentId: parsed.data.studentId,
        facultyId: parsed.data.facultyId,
        course: parsed.data.course,
        groupName: parsed.data.groupName,
      },
    });
  }
  return { ok: true, data: null };
}

export async function removeMember(userId: string, memberId: string): Promise<ActionResult> {
  const window = await assertMemberWindow();
  if (!window.ok) return window;
  const member = await prisma.teamMember.findFirst({ where: { id: memberId, team: { leaderId: userId } } });
  if (!member) return { ok: false, code: "not_found" };
  if (member.isLeader) return { ok: false, code: "cannot_remove_leader" };
  await prisma.teamMember.delete({ where: { id: member.id } });
  return { ok: true, data: null };
}

async function ownSubmission(userId: string, stageKey: StageKey) {
  const user = await leaderContext(userId);
  const project = user?.ledTeam?.project;
  if (!user?.ledTeam || !project) return null;
  let submission = project.submissions.find((item) => item.stageKey === stageKey) ?? null;
  if (!submission && stageKey === "STAGE2") {
    const stage1 = await prisma.stageResult.findFirst({
      where: { stageKey: "STAGE1", submission: { projectId: project.id }, advanced: true },
    });
    const stage2 = await stageByKey("STAGE2");
    if (stage1 && stage2 && stage2.status !== "DRAFT") {
      submission = await prisma.submission.create({
        data: { projectId: project.id, stageKey: "STAGE2", payload: {} },
        include: { files: true, links: true },
      });
    }
  }
  return { user, team: user.ledTeam, project, submission };
}

async function writeGuard(stageKey: StageKey, status: "DRAFT" | "SUBMITTED" | "UPDATED" | "LOCKED", updateUsedAt: Date | null, intent: "save_draft" | "submit" | "update") {
  const stage = await stageByKey(stageKey);
  if (!stage) return { ok: false as const, code: "not_found" };
  const decision = evaluateWrite(new Date(), stage, { status, updateUsedAt }, intent);
  if (!decision.ok && !(intent === "submit" && decision.code === "already_submitted")) {
    await audit({ action: "deadline_rejected", entity: "Stage", entityId: stage.id, meta: { intent, code: decision.code } });
  }
  return { ok: true as const, stage, decision };
}

async function replaceLinks(submissionId: string, links: { kind: LinkKind; url: string }[], pending: boolean) {
  for (const link of links) {
    await prisma.submissionLink.updateMany({
      where: { submissionId, kind: link.kind, isCurrent: true },
      data: { isCurrent: false },
    });
    if (!link.url) continue;
    await prisma.submissionLink.create({
      data: { submissionId, kind: link.kind, url: link.url, isCurrent: !pending, pending },
    });
  }
}

function linkValue(links: { kind: LinkKind; url: string; isCurrent: boolean; pending: boolean }[], kind: LinkKind) {
  return links.find((link) => link.kind === kind && (link.isCurrent || link.pending))?.url ?? "";
}

export async function saveStage1(userId: string, raw: unknown, intent: "save_draft" | "submit" | "update"): Promise<ActionResult<{ eligible: boolean }>> {
  const owned = await ownSubmission(userId, "STAGE1");
  if (!owned?.submission) return { ok: false, code: "not_found" };
  const guard = await writeGuard("STAGE1", owned.submission.status, owned.submission.updateUsedAt, intent);
  if (!guard.ok) return guard;
  if (intent === "submit") {
    const interpreted = interpretSubmit(guard.decision);
    if (!interpreted.ok) return interpreted;
    if (interpreted.idempotent) return { ok: true, data: { eligible: await teamIsEligible(owned.team.id) } };
  } else if (!guard.decision.ok) return guard.decision;

  const parsed = (intent === "save_draft" ? stage1DraftSchema : stage1Schema).safeParse(raw);
  if (!parsed.success) return { ok: false, code: intent === "save_draft" ? "invalid_input" : "incomplete", field: parsed.error.issues[0]?.path[0]?.toString() };
  const data = parsed.data as Stage1Draft;
  const track = await prisma.track.findFirst({ where: { id: data.trackId, isActive: true } });
  if (!track) return { ok: false, code: "invalid_input", field: "trackId" };
  await prisma.project.update({ where: { id: owned.project.id }, data: { title: data.title, trackId: track.id } });
  if (intent === "save_draft") {
    await prisma.submission.update({ where: { id: owned.submission.id }, data: { payload: data } });
    return { ok: true, data: { eligible: await teamIsEligible(owned.team.id) } };
  }
  if (intent === "submit") {
    await prisma.submission.update({
      where: { id: owned.submission.id },
      data: { payload: data, status: "SUBMITTED", firstSubmittedAt: new Date() },
    });
    await notifyUser({ userId, type: "submitted", titleKey: "submitted", payload: { stage: "STAGE1", project: data.title } });
    await audit({ actorId: userId, action: "submit", entity: "Submission", entityId: owned.submission.id });
  } else {
    await prisma.submission.update({
      where: { id: owned.submission.id },
      data: { payload: data, status: "UPDATED", updateUsedAt: new Date() },
    });
    await notifyUser({ userId, type: "updated", titleKey: "updated", payload: { stage: "STAGE1", project: data.title } });
    await audit({ actorId: userId, action: "update_submission", entity: "Submission", entityId: owned.submission.id });
  }
  return { ok: true, data: { eligible: await teamIsEligible(owned.team.id) } };
}

function materialErrors(input: Stage2Input, files: { kind: FileKind; isCurrent: boolean; pending: boolean }[]) {
  const errors: string[] = [];
  const has = (kind: FileKind) => files.some((file) => file.kind === kind && (file.isCurrent || file.pending));
  if (!safeHttpUrl(input.productUrl)) errors.push("product");
  if (!safeHttpUrl(input.videoUrl) && !has("VIDEO_FILE")) errors.push("video");
  if (!has("PRD_PDF")) errors.push("prd");
  if (!has("PITCH_DECK")) errors.push("deck");
  if (input.softwareProject) {
    if (!safeHttpUrl(input.githubUrl)) errors.push("github");
  } else if (!input.equivalentProof.trim() && !has("EQUIVALENT_PROOF")) errors.push("equivalent");
  if (!input.priorWork.trim() || !input.aiTools.trim() || !input.openSource.trim() || !input.limitations.trim()) errors.push("disclosure");
  if (!CHECKLIST_KEYS.every((key) => input.checklist[key])) errors.push("checklist");
  return errors;
}

export async function saveStage2(userId: string, raw: unknown, intent: "save_draft" | "submit" | "update"): Promise<ActionResult> {
  const owned = await ownSubmission(userId, "STAGE2");
  if (!owned?.submission) return { ok: false, code: "not_selected" };
  const guard = await writeGuard("STAGE2", owned.submission.status, owned.submission.updateUsedAt, intent);
  if (!guard.ok) return guard;
  if (intent === "submit") {
    const interpreted = interpretSubmit(guard.decision);
    if (!interpreted.ok) return interpreted;
    if (interpreted.idempotent) return { ok: true, data: null };
  } else if (!guard.decision.ok) return guard.decision;

  const parsed = stage2Schema.safeParse(raw);
  if (!parsed.success) return { ok: false, code: "invalid_input" };
  const input = parsed.data;
  for (const value of [input.productUrl, input.videoUrl, input.githubUrl]) {
    if (value && !safeHttpUrl(value)) return { ok: false, code: "invalid_url" };
  }
  if (intent !== "save_draft") {
    const missing = materialErrors(input, owned.submission.files);
    if (missing.length) return { ok: false, code: missing.includes("checklist") ? "checklist_incomplete" : "incomplete", field: missing[0] };
  }
  const links = [
    { kind: "PRODUCT" as const, url: safeHttpUrl(input.productUrl) ?? "" },
    { kind: "VIDEO" as const, url: safeHttpUrl(input.videoUrl) ?? "" },
    { kind: "GITHUB" as const, url: safeHttpUrl(input.githubUrl) ?? "" },
  ];
  if (intent === "update") {
    await prisma.$transaction(async (tx) => {
      const pendingFiles = await tx.submissionFile.findMany({ where: { submissionId: owned.submission!.id, pending: true } });
      const kinds = [...new Set(pendingFiles.map((file) => file.kind))];
      for (const kind of kinds) {
        const newest = pendingFiles.filter((file) => file.kind === kind).sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())[0];
        if (!newest) continue;
        await tx.submissionFile.updateMany({ where: { submissionId: owned.submission!.id, kind, isCurrent: true }, data: { isCurrent: false } });
        await tx.submissionFile.update({ where: { id: newest.id }, data: { isCurrent: true, pending: false } });
        await tx.submissionFile.updateMany({
          where: { submissionId: owned.submission!.id, kind, pending: true, id: { not: newest.id } },
          data: { pending: false, isCurrent: false },
        });
      }
      await tx.submission.update({
        where: { id: owned.submission!.id },
        data: { payload: input, status: "UPDATED", updateUsedAt: new Date() },
      });
    });
    await replaceLinks(owned.submission.id, links, false);
    await notifyUser({ userId, type: "updated", titleKey: "updated", payload: { stage: "STAGE2", project: owned.project.title } });
  } else if (intent === "submit") {
    await prisma.submission.update({
      where: { id: owned.submission.id },
      data: { payload: input, status: "SUBMITTED", firstSubmittedAt: new Date() },
    });
    await replaceLinks(owned.submission.id, links, false);
    await notifyUser({ userId, type: "submitted", titleKey: "submitted", payload: { stage: "STAGE2", project: owned.project.title } });
  } else {
    await prisma.submission.update({ where: { id: owned.submission.id }, data: { payload: input } });
    await replaceLinks(owned.submission.id, links, false);
  }
  return { ok: true, data: null };
}

export async function changeOwnPassword(userId: string, currentPassword: string, nextPassword: string): Promise<ActionResult> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, code: "not_found" };
  const matches = await argon2.verify(user.passwordHash, currentPassword);
  if (!matches) return { ok: false, code: "invalid_credentials" };
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await argon2.hash(nextPassword), mustChangePassword: false },
  });
  return { ok: true, data: null };
}

export async function requestPasswordReset(studentId: string, locale: string): Promise<ActionResult> {
  const settings = await getSettings();
  if (!settings.emailPasswordReset) return { ok: false, code: "email_reset_disabled" };
  if (!process.env.SMTP_HOST) return { ok: false, code: "smtp_not_configured" };
  const user = await prisma.user.findUnique({ where: { studentId } });
  if (!user?.email) return { ok: true, data: null };
  const token = (await import("@/lib/storage")).randomToken();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 1000 * 60 * 30) },
  });
  const { default: nodemailer } = await import("nodemailer");
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  const base = process.env.AUTH_URL || "http://localhost:3000";
  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: user.email,
    subject: "MU Hackathon",
    text: `${base}/${locale}/reset-password?token=${token}`,
  });
  return { ok: true, data: null };
}

export async function resetPasswordWithToken(token: string, nextPassword: string): Promise<ActionResult> {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!row || row.usedAt || row.expiresAt < new Date()) return { ok: false, code: "token_invalid" };
  await prisma.user.update({
    where: { id: row.userId },
    data: { passwordHash: await argon2.hash(nextPassword), mustChangePassword: false },
  });
  await prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  return { ok: true, data: null };
}

export async function markNotificationRead(userId: string, id: string) {
  await prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
  return { ok: true as const, data: null };
}

export async function markAllNotificationsRead(userId: string) {
  await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
  return { ok: true as const, data: null };
}

export { readStage1, readStage2, linkValue };
