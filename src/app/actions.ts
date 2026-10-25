"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { FileKind, Role, StageKey, StageStatus, VerificationStatus } from "@prisma/client";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/utils";
import { changePasswordSchema } from "@/lib/validation";
import * as participant from "@/server/participant";
import * as judge from "@/server/judge";
import * as admin from "@/server/admin";
import type { PlatformSettings } from "@/lib/settings";
import type { ContentSection, FaqItem } from "@/lib/payload";

function refresh() {
  revalidatePath("/", "layout");
}

async function actor(roles?: Role[]) {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.isActive) return null;
  if (roles && !roles.includes(user.role)) return null;
  return user;
}

export async function registerAction(input: unknown) {
  const headerStore = await headers();
  const result = await participant.registerParticipant(input, clientIp(headerStore));
  if (result.ok) refresh();
  return result;
}

export async function saveTeamNameAction(name: string) {
  const user = await actor(["PARTICIPANT"]);
  if (!user) return { ok: false as const, code: "forbidden" };
  const result = await participant.saveTeamName(user.id, name);
  if (result.ok) refresh();
  return result;
}

export async function addMemberAction(input: unknown) {
  const user = await actor(["PARTICIPANT"]);
  if (!user) return { ok: false as const, code: "forbidden" };
  const result = await participant.addMember(user.id, input);
  if (result.ok) refresh();
  return result;
}

export async function updateMemberAction(memberId: string, input: unknown) {
  const user = await actor(["PARTICIPANT"]);
  if (!user) return { ok: false as const, code: "forbidden" };
  const result = await participant.updateMember(user.id, memberId, input);
  if (result.ok) refresh();
  return result;
}

export async function removeMemberAction(memberId: string) {
  const user = await actor(["PARTICIPANT"]);
  if (!user) return { ok: false as const, code: "forbidden" };
  const result = await participant.removeMember(user.id, memberId);
  if (result.ok) refresh();
  return result;
}

export async function saveStage1Action(input: unknown, intent: "save_draft" | "submit" | "update") {
  const user = await actor(["PARTICIPANT"]);
  if (!user) return { ok: false as const, code: "forbidden" };
  const result = await participant.saveStage1(user.id, input, intent);
  if (result.ok) refresh();
  return result;
}

export async function saveStage2Action(input: unknown, intent: "save_draft" | "submit" | "update") {
  const user = await actor(["PARTICIPANT"]);
  if (!user) return { ok: false as const, code: "forbidden" };
  const result = await participant.saveStage2(user.id, input, intent);
  if (result.ok) refresh();
  return result;
}

export async function changePasswordAction(input: unknown) {
  const user = await actor();
  if (!user) return { ok: false as const, code: "forbidden" };
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, code: parsed.error.issues[0]?.message === "passwords_mismatch" ? "passwords_mismatch" : "invalid_input" };
  const result = await participant.changeOwnPassword(user.id, parsed.data.currentPassword, parsed.data.nextPassword);
  if (result.ok) refresh();
  return result;
}

export async function requestResetAction(studentId: string, locale: string) {
  return participant.requestPasswordReset(studentId, locale);
}

export async function resetWithTokenAction(token: string, password: string) {
  return participant.resetPasswordWithToken(token, password);
}

export async function readNotificationAction(id: string) {
  const user = await actor();
  if (!user) return { ok: false as const, code: "forbidden" };
  const result = await participant.markNotificationRead(user.id, id);
  refresh();
  return result;
}

export async function readAllNotificationsAction() {
  const user = await actor();
  if (!user) return { ok: false as const, code: "forbidden" };
  const result = await participant.markAllNotificationsRead(user.id);
  refresh();
  return result;
}

export async function logoutAction() {
  await signOut({ redirect: false });
}

export async function saveScoreAction(submissionId: string, input: unknown, finalize: boolean) {
  const user = await actor(["JUDGE"]);
  if (!user) return { ok: false as const, code: "forbidden" };
  const result = await judge.saveJudgeScore({ judgeId: user.id, submissionId, raw: input, finalize });
  if (result.ok) refresh();
  return result;
}

export async function conflictAction(submissionId: string, note: string) {
  const user = await actor(["JUDGE"]);
  if (!user) return { ok: false as const, code: "forbidden" };
  const result = await judge.declareConflict(user.id, submissionId, note);
  if (result.ok) refresh();
  return result;
}

async function adminOnly() {
  return actor(["ADMIN"]);
}

export async function transitionStageAction(key: StageKey, status: StageStatus) {
  const user = await adminOnly();
  if (!user) return { ok: false as const, code: "forbidden" };
  const result = await admin.transitionStage(user.id, key, status);
  if (result.ok) refresh();
  return result;
}

export async function updateStageDatesAction(key: StageKey, opensAt: string, updateDeadlineAt: string, deadlineAt: string) {
  const user = await adminOnly();
  if (!user) return { ok: false as const, code: "forbidden" };
  const result = await admin.updateStageDates(user.id, key, opensAt, updateDeadlineAt, deadlineAt);
  if (result.ok) refresh();
  return result;
}

export async function verifyMemberAction(memberId: string, status: VerificationStatus, note: string) {
  const user = await adminOnly();
  if (!user) return { ok: false as const, code: "forbidden" };
  const result = await admin.setVerification(user.id, memberId, status, note);
  if (result.ok) refresh();
  return result;
}

export async function eligibilityAction(teamId: string, value: boolean) {
  const user = await adminOnly();
  if (!user) return { ok: false as const, code: "forbidden" };
  const result = await admin.setEligibilityOverride(user.id, teamId, value);
  if (result.ok) refresh();
  return result;
}

export async function resetPasswordAction(userId: string) {
  const user = await adminOnly();
  if (!user) return { ok: false as const, code: "forbidden" };
  const result = await admin.resetUserPassword(user.id, userId);
  if (result.ok) refresh();
  return result;
}

export async function setActiveAction(userId: string, isActive: boolean) {
  const user = await adminOnly();
  if (!user) return { ok: false as const, code: "forbidden" };
  const result = await admin.setUserActive(user.id, userId, isActive);
  if (result.ok) refresh();
  return result;
}

export async function createStaffAction(input: { fullName: string; studentId: string; role: "JUDGE" | "ADMIN"; email?: string }) {
  const user = await adminOnly();
  if (!user) return { ok: false as const, code: "forbidden" };
  const result = await admin.createStaff(user.id, input);
  if (result.ok) refresh();
  return result;
}

export async function importRosterAction(text: string, commit: boolean) {
  const user = await adminOnly();
  if (!user) return { ok: false as const, code: "forbidden" };
  const result = await admin.importRoster(user.id, text, commit);
  if (result.ok && commit) refresh();
  return result;
}

export async function autoAssignAction(stageKey: StageKey) {
  const user = await adminOnly();
  if (!user) return { ok: false as const, code: "forbidden" };
  const result = await admin.autoAssign(user.id, stageKey);
  if (result.ok) refresh();
  return result;
}

export async function setAssignmentAction(judgeId: string, submissionId: string, assigned: boolean) {
  const user = await adminOnly();
  if (!user) return { ok: false as const, code: "forbidden" };
  const result = await admin.setAssignment(user.id, judgeId, submissionId, assigned);
  if (result.ok) refresh();
  return result;
}

export async function computeRankingAction(stageKey: StageKey) {
  const user = await adminOnly();
  if (!user) return { ok: false as const, code: "forbidden" };
  const result = await admin.computeRanking(user.id, stageKey);
  if (result.ok) refresh();
  return result;
}

export async function resolveTieAction(resultId: string, advanced: boolean, note: string) {
  const user = await adminOnly();
  if (!user) return { ok: false as const, code: "forbidden" };
  const result = await admin.resolveTie(user.id, resultId, advanced, note);
  if (result.ok) refresh();
  return result;
}

export async function selectTopAction(stageKey: StageKey, acknowledgeDiscrepancy: boolean) {
  const user = await adminOnly();
  if (!user) return { ok: false as const, code: "forbidden" };
  const result = await admin.selectTop(user.id, stageKey, acknowledgeDiscrepancy);
  if (result.ok) refresh();
  return result;
}

export async function publishStageAction(stageKey: StageKey, confirmIfNone: boolean) {
  const user = await adminOnly();
  if (!user) return { ok: false as const, code: "forbidden" };
  const result = await admin.publishStage(user.id, stageKey, confirmIfNone);
  if (result.ok) refresh();
  return result;
}

export async function revealScoresAction(stageKey: StageKey, value: boolean) {
  const user = await adminOnly();
  if (!user) return { ok: false as const, code: "forbidden" };
  const result = await admin.revealScores(user.id, stageKey, value);
  if (result.ok) refresh();
  return result;
}

export async function reopenEvaluationAction(assignmentId: string) {
  const user = await adminOnly();
  if (!user) return { ok: false as const, code: "forbidden" };
  const result = await admin.reopenEvaluation(user.id, assignmentId);
  if (result.ok) refresh();
  return result;
}

export async function unlockSubmissionAction(submissionId: string, reason: string) {
  const user = await adminOnly();
  if (!user) return { ok: false as const, code: "forbidden" };
  const result = await admin.adminUnlockSubmission(user.id, submissionId, reason);
  if (result.ok) refresh();
  return result;
}

export async function saveSettingsAction(value: PlatformSettings) {
  const user = await adminOnly();
  if (!user) return { ok: false as const, code: "forbidden" };
  const result = await admin.savePlatformSettings(user.id, value);
  if (result.ok) refresh();
  return result;
}

export async function saveContentAction(key: string, value: ContentSection[] | FaqItem[]) {
  const user = await adminOnly();
  if (!user) return { ok: false as const, code: "forbidden" };
  const result = await admin.saveContent(user.id, key, value);
  if (result.ok) refresh();
  return result;
}

export async function saveFacultyAction(input: { id?: string; nameUz: string; nameRu: string; nameEn: string; isActive: boolean }) {
  const user = await adminOnly();
  if (!user) return { ok: false as const, code: "forbidden" };
  const result = await admin.saveFaculty(user.id, input);
  if (result.ok) refresh();
  return result;
}

export async function saveTrackAction(input: { id?: string; slug: string; nameUz: string; nameRu: string; nameEn: string; descUz: string; descRu: string; descEn: string; isActive: boolean }) {
  const user = await adminOnly();
  if (!user) return { ok: false as const, code: "forbidden" };
  const result = await admin.saveTrack(user.id, input);
  if (result.ok) refresh();
  return result;
}

export async function saveAnnouncementAction(input: { id?: string; titleUz: string; titleRu: string; titleEn: string; bodyUz: string; bodyRu: string; bodyEn: string; publish: boolean }) {
  const user = await adminOnly();
  if (!user) return { ok: false as const, code: "forbidden" };
  const result = await admin.saveAnnouncement(user.id, input);
  if (result.ok) refresh();
  return result;
}

export async function remindAction() {
  const user = await adminOnly();
  if (!user) return { ok: false as const, code: "forbidden" };
  const result = await admin.sendDeadlineReminders(user.id);
  if (result.ok) refresh();
  return result;
}

export async function uploadMetaAction(submissionId: string, kind: FileKind) {
  const user = await actor(["PARTICIPANT"]);
  if (!user) return { ok: false as const, code: "forbidden" };
  return { ok: true as const, data: { submissionId, kind, userId: user.id } };
}
