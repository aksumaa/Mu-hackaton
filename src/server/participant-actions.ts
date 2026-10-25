"use server";

import { Prisma, type FileKind, type StageKey } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { CHECKLIST_KEYS } from "@/lib/catalog";
import { evaluateWrite, interpretSubmit, type WriteIntent } from "@/lib/deadlines";
import { extensionAllowed, matchesKind } from "@/lib/file-magic";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { deleteObject, newStorageKey, putObject } from "@/lib/storage";
import { requireUser } from "@/lib/session";
import { normalizeGroup, safeHttpUrl } from "@/lib/utils";
import { scanFile } from "@/lib/virus-scan";
import { memberSchema, stage1DraftSchema, stage1Schema, stage2Schema } from "@/lib/validation";
import { checked, localeOf, text, type ActionState } from "@/server/action-state";

async function leaderTeam(userId: string) {
  return prisma.team.findUnique({
    where: { leaderId: userId },
    include: {
      members: true,
      project: { include: { submissions: { include: { files: true, links: true, results: true } } } },
    },
  });
}

function stage1Fields(form: FormData) {
  return {
    title: text(form, "title"),
    trackId: text(form, "trackId"),
    shortDescription: text(form, "shortDescription"),
    problem: text(form, "problem"),
    audience: text(form, "audience"),
    solution: text(form, "solution"),
    differentiation: text(form, "differentiation"),
    validation: text(form, "validation"),
    teamRoles: text(form, "teamRoles"),
    consent: checked(form, "consent"),
  };
}

async function openStage(key: StageKey) {
  return prisma.stage.findUnique({ where: { key } });
}

export async function saveStage1(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return writeStage1(formData, "save_draft");
}

export async function submitStage1(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return writeStage1(formData, "submit");
}

export async function updateStage1(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return writeStage1(formData, "update");
}

async function writeStage1(formData: FormData, intent: WriteIntent): Promise<ActionState> {
  const locale = localeOf(formData);
  const user = await requireUser(locale);
  if (user.role !== "PARTICIPANT") return { error: "forbidden" };
  const fields = stage1Fields(formData);
  const parsed = (intent === "save_draft" ? stage1DraftSchema : stage1Schema).safeParse(fields);
  if (!parsed.success) return { error: "invalid_field", field: String(parsed.error.issues[0]?.path[0] ?? "title") };
  const stage = await openStage("STAGE1");
  const team = await leaderTeam(user.id);
  if (!stage || !team) return { error: "stage_not_open" };
  const submission = team.project?.submissions.find((item) => item.stageKey === "STAGE1") ?? null;
  const decision = evaluateWrite(new Date(), stage, submission, intent);
  if (intent === "submit") {
    const interpreted = interpretSubmit(decision);
    if (!interpreted.ok) {
      await audit({ actorId: user.id, action: "submission_rejected", entity: "Stage", entityId: stage.id, meta: { code: interpreted.code, intent } });
      return { error: interpreted.code };
    }
    if (interpreted.idempotent) return { ok: true, notice: "already_submitted" };
  } else if (!decision.ok) {
    await audit({ actorId: user.id, action: "submission_rejected", entity: "Stage", entityId: stage.id, meta: { code: decision.code, intent } });
    return { error: decision.code };
  }
  const track = await prisma.track.findFirst({ where: { id: parsed.data.trackId, isActive: true } });
  if (!track) return { error: "invalid_field", field: "trackId" };
  const payload = { ...parsed.data };
  delete (payload as { trackId?: string }).trackId;
  if (intent === "update") {
    if (!submission) return { error: "update_not_available" };
    const updated = await prisma.submission.updateMany({
      where: { id: submission.id, status: "SUBMITTED", updateUsedAt: null },
      data: { status: "UPDATED", updateUsedAt: new Date(), payload },
    });
    if (updated.count !== 1) return { error: "update_used" };
    await prisma.project.update({ where: { id: submission.projectId }, data: { title: parsed.data.title, trackId: track.id } });
  } else if (!team.project) {
    await prisma.project.create({
      data: {
        teamId: team.id,
        trackId: track.id,
        title: parsed.data.title,
        submissions: {
          create: {
            stageKey: "STAGE1",
            status: intent === "submit" ? "SUBMITTED" : "DRAFT",
            firstSubmittedAt: intent === "submit" ? new Date() : null,
            payload,
          },
        },
      },
    });
  } else if (!submission) {
    await prisma.project.update({ where: { id: team.project.id }, data: { title: parsed.data.title, trackId: track.id } });
    await prisma.submission.create({
      data: {
        projectId: team.project.id,
        stageKey: "STAGE1",
        status: intent === "submit" ? "SUBMITTED" : "DRAFT",
        firstSubmittedAt: intent === "submit" ? new Date() : null,
        payload,
      },
    });
  } else if (intent === "submit") {
    const updated = await prisma.submission.updateMany({
      where: { id: submission.id, status: "DRAFT" },
      data: { status: "SUBMITTED", firstSubmittedAt: new Date(), payload },
    });
    if (updated.count !== 1) return { ok: true, notice: "already_submitted" };
    await prisma.project.update({ where: { id: team.project.id }, data: { title: parsed.data.title, trackId: track.id } });
  } else {
    const updated = await prisma.submission.updateMany({
      where: { id: submission.id, status: "DRAFT" },
      data: { payload },
    });
    if (updated.count !== 1) return { error: "not_draft" };
    await prisma.project.update({ where: { id: team.project.id }, data: { title: parsed.data.title, trackId: track.id } });
  }
  revalidatePath(`/${locale}/cabinet`, "layout");
  return { ok: true };
}

function membersEditable(stage: { status: string; deadlineAt: Date } | null, now = new Date()) {
  return Boolean(stage && stage.status === "OPEN" && now.getTime() <= stage.deadlineAt.getTime());
}

export async function addMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = localeOf(formData);
  const user = await requireUser(locale);
  if (user.role !== "PARTICIPANT") return { error: "forbidden" };
  const stage = await openStage("STAGE1");
  if (!membersEditable(stage)) {
    await audit({ actorId: user.id, action: "member_rejected", entity: "Stage", entityId: stage?.id, meta: { code: "deadline_passed" } });
    return { error: "deadline_passed" };
  }
  const parsed = memberSchema.safeParse({
    fullName: text(formData, "fullName"),
    studentId: text(formData, "studentId"),
    facultyId: text(formData, "facultyId"),
    course: text(formData, "course"),
    groupName: text(formData, "groupName"),
  });
  if (!parsed.success) return { error: "invalid_field", field: String(parsed.error.issues[0]?.path[0] ?? "fullName") };
  const team = await leaderTeam(user.id);
  if (!team) return { error: "forbidden" };
  if (team.members.length >= 4) return { error: "team_full" };
  const roster = await prisma.rosterEntry.findUnique({ where: { studentId: parsed.data.studentId } });
  const verificationStatus =
    roster && roster.facultyId === parsed.data.facultyId && normalizeGroup(roster.groupName) === normalizeGroup(parsed.data.groupName)
      ? "VERIFIED"
      : "PENDING";
  try {
    await prisma.teamMember.create({
      data: { teamId: team.id, ...parsed.data, verificationStatus, isLeader: false },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { error: "member_exists", field: "studentId" };
    return { error: "generic" };
  }
  revalidatePath(`/${locale}/cabinet`, "layout");
  return { ok: true };
}

export async function removeMember(formData: FormData): Promise<void> {
  const locale = localeOf(formData);
  const user = await requireUser(locale);
  const stage = await openStage("STAGE1");
  if (user.role !== "PARTICIPANT" || !membersEditable(stage)) return;
  const team = await leaderTeam(user.id);
  const memberId = text(formData, "memberId");
  const member = team?.members.find((item) => item.id === memberId && !item.isLeader);
  if (!member) return;
  await prisma.teamMember.delete({ where: { id: member.id } });
  revalidatePath(`/${locale}/cabinet`, "layout");
}

function stage2Fields(form: FormData) {
  const checklist = Object.fromEntries(CHECKLIST_KEYS.map((key) => [key, checked(form, `check_${key}`)]));
  return {
    softwareProject: checked(form, "softwareProject"),
    productUrl: text(form, "productUrl"),
    accessInstructions: text(form, "accessInstructions"),
    videoUrl: text(form, "videoUrl"),
    githubUrl: text(form, "githubUrl"),
    equivalentProof: text(form, "equivalentProof"),
    priorWork: text(form, "priorWork"),
    aiTools: text(form, "aiTools"),
    openSource: text(form, "openSource"),
    limitations: text(form, "limitations"),
    checklist,
  };
}

async function stage2Allowed(userId: string) {
  const stage1 = await prisma.submission.findFirst({
    where: { stageKey: "STAGE1", project: { team: { leaderId: userId } } },
    include: { results: true },
  });
  return Boolean(stage1?.results.some((result) => result.stageKey === "STAGE1" && result.advanced));
}

async function storeFile(input: {
  submissionId: string;
  kind: FileKind;
  file: File;
  settingsMaxMb: number;
  videoEnabled: boolean;
}) {
  if (input.kind === "VIDEO_FILE" && !input.videoEnabled) return { error: "video_disabled" as const };
  if (input.file.size <= 0 || input.file.size > input.settingsMaxMb * 1024 * 1024) return { error: "file_size" as const };
  if (!extensionAllowed(input.kind, input.file.name)) return { error: "file_type" as const };
  const buffer = Buffer.from(await input.file.arrayBuffer());
  if (!(await matchesKind(input.kind, input.file.type, buffer))) return { error: "file_type" as const };
  const scan = await scanFile(buffer);
  if (!scan.clean) return { error: "file_scan" as const };
  const key = newStorageKey("submissions");
  await putObject(key, buffer, input.file.type);
  try {
    await prisma.$transaction([
      prisma.submissionFile.updateMany({
        where: { submissionId: input.submissionId, kind: input.kind, isCurrent: true },
        data: { isCurrent: false },
      }),
      prisma.submissionFile.create({
        data: {
          submissionId: input.submissionId,
          kind: input.kind,
          storageKey: key,
          originalName: input.file.name.slice(0, 180),
          size: input.file.size,
          mime: input.file.type,
          isCurrent: true,
          pending: false,
        },
      }),
    ]);
  } catch (error) {
    await deleteObject(key).catch(() => undefined);
    throw error;
  }
  return { ok: true as const };
}

export async function uploadStage2File(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = localeOf(formData);
  const user = await requireUser(locale);
  if (user.role !== "PARTICIPANT") return { error: "forbidden" };
  if (!(await stage2Allowed(user.id))) return { error: "stage2_closed" };
  const stage = await openStage("STAGE2");
  const team = await leaderTeam(user.id);
  const submission = team?.project?.submissions.find((item) => item.stageKey === "STAGE2") ?? null;
  if (!stage || !submission) return { error: "stage_not_open" };
  const decision = evaluateWrite(new Date(), stage, submission, "save_draft");
  if (!decision.ok) {
    await audit({ actorId: user.id, action: "upload_rejected", entity: "Submission", entityId: submission.id, meta: { code: decision.code } });
    return { error: decision.code === "not_draft" ? "upload_with_update" : decision.code };
  }
  const kind = text(formData, "kind") as FileKind;
  if (!["PRD_PDF", "PITCH_DECK", "VIDEO_FILE", "EQUIVALENT_PROOF"].includes(kind)) return { error: "file_type" };
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "file_type" };
  const settings = await getSettings();
  const stored = await storeFile({
    submissionId: submission.id,
    kind,
    file,
    settingsMaxMb: settings.maxFileMb[kind],
    videoEnabled: settings.videoUploadEnabled,
  });
  if ("error" in stored) return { error: stored.error };
  revalidatePath(`/${locale}/cabinet/stage-2`);
  return { ok: true };
}

function cleanUrl(value: string) {
  if (!value.trim()) return "";
  return safeHttpUrl(value);
}

async function applyLinks(submissionId: string, urls: { PRODUCT: string; GITHUB: string; VIDEO: string }) {
  for (const kind of ["PRODUCT", "GITHUB", "VIDEO"] as const) {
    const url = urls[kind];
    await prisma.submissionLink.updateMany({ where: { submissionId, kind, isCurrent: true }, data: { isCurrent: false } });
    if (url) {
      await prisma.submissionLink.create({ data: { submissionId, kind, url, isCurrent: true, pending: false } });
    }
  }
}

export async function saveStage2(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return writeStage2(formData, "save_draft");
}

export async function submitStage2(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return writeStage2(formData, "submit");
}

export async function updateStage2(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return writeStage2(formData, "update");
}

async function writeStage2(formData: FormData, intent: WriteIntent): Promise<ActionState> {
  const locale = localeOf(formData);
  const user = await requireUser(locale);
  if (user.role !== "PARTICIPANT") return { error: "forbidden" };
  if (!(await stage2Allowed(user.id))) return { error: "stage2_closed" };
  const stage = await openStage("STAGE2");
  const team = await leaderTeam(user.id);
  if (!stage || !team?.project) return { error: "stage_not_open" };
  const existing = team.project.submissions.find((item) => item.stageKey === "STAGE2") ?? null;
  const decision = evaluateWrite(new Date(), stage, existing, intent);
  if (intent === "submit") {
    const interpreted = interpretSubmit(decision);
    if (!interpreted.ok) {
      await audit({ actorId: user.id, action: "submission_rejected", entity: "Submission", entityId: existing?.id, meta: { code: interpreted.code } });
      return { error: interpreted.code };
    }
    if (interpreted.idempotent) return { ok: true, notice: "already_submitted" };
  } else if (!decision.ok) {
    await audit({ actorId: user.id, action: "submission_rejected", entity: "Submission", entityId: existing?.id, meta: { code: decision.code, intent } });
    return { error: decision.code };
  }
  const submissionId = existing?.id ?? (await prisma.submission.create({
    data: { projectId: team.project.id, stageKey: "STAGE2", status: "DRAFT", payload: {} },
  })).id;
  const parsed = stage2Schema.safeParse(stage2Fields(formData));
  if (!parsed.success) return { error: "invalid_field" };
  const data = parsed.data;
  for (const value of [data.productUrl, data.videoUrl, data.githubUrl]) {
    if (value.trim() && !safeHttpUrl(value)) return { error: "invalid_url" };
  }
  const settings = await getSettings();
  const prepared: { kind: FileKind; buffer: Buffer; name: string; mime: string }[] = [];
  for (const kind of ["PRD_PDF", "PITCH_DECK", "VIDEO_FILE", "EQUIVALENT_PROOF"] as const) {
    const file = formData.get(`file_${kind}`);
    if (!(file instanceof File) || file.size <= 0) continue;
    if (kind === "VIDEO_FILE" && !settings.videoUploadEnabled) return { error: "video_disabled" };
    if (file.size > settings.maxFileMb[kind] * 1024 * 1024) return { error: "file_size" };
    if (!extensionAllowed(kind, file.name)) return { error: "file_type" };
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!(await matchesKind(kind, file.type, buffer))) return { error: "file_type" };
    const scan = await scanFile(buffer);
    if (!scan.clean) return { error: "file_scan" };
    prepared.push({ kind, buffer, name: file.name.slice(0, 180), mime: file.type });
  }
  const uploads = prepared;
  if (intent !== "save_draft") {
    const currentFiles = await prisma.submissionFile.findMany({ where: { submissionId: submissionId, isCurrent: true } });
    const kinds = new Set([...currentFiles.map((file) => file.kind), ...uploads.map((file) => file.kind)]);
    if (!kinds.has("PRD_PDF")) return { error: "prd_required" };
    if (!kinds.has("PITCH_DECK")) return { error: "deck_required" };
    if (!data.videoUrl.trim() && !kinds.has("VIDEO_FILE")) return { error: "video_required" };
    if (!safeHttpUrl(data.productUrl) || data.accessInstructions.trim().length < 3) return { error: "product_required" };
    const hasEquivalent = data.equivalentProof.trim().length > 0 || kinds.has("EQUIVALENT_PROOF");
    if (data.softwareProject && !safeHttpUrl(data.githubUrl) && !hasEquivalent) return { error: "github_required" };
    if (!data.softwareProject && !safeHttpUrl(data.githubUrl) && !hasEquivalent) return { error: "github_required" };
    if (CHECKLIST_KEYS.some((key) => !data.checklist[key])) return { error: "checklist_incomplete" };
  }
  const stored: { kind: FileKind; key: string; name: string; mime: string; size: number }[] = [];
  try {
    for (const upload of uploads) {
      const key = newStorageKey("submissions");
      await putObject(key, upload.buffer, upload.mime);
      stored.push({ kind: upload.kind, key, name: upload.name, mime: upload.mime, size: upload.buffer.length });
    }
    const payload = data;
    if (intent === "update") {
      const updated = await prisma.submission.updateMany({
        where: { id: submissionId, status: "SUBMITTED", updateUsedAt: null },
        data: { status: "UPDATED", updateUsedAt: new Date(), payload: payload as unknown as Prisma.InputJsonValue },
      });
      if (updated.count !== 1) {
        await Promise.all(stored.map((item) => deleteObject(item.key).catch(() => undefined)));
        return { error: "update_used" };
      }
    } else if (intent === "submit") {
      const updated = await prisma.submission.updateMany({
        where: { id: submissionId, status: "DRAFT" },
        data: { status: "SUBMITTED", firstSubmittedAt: new Date(), payload: payload as unknown as Prisma.InputJsonValue },
      });
      if (updated.count !== 1) {
        await Promise.all(stored.map((item) => deleteObject(item.key).catch(() => undefined)));
        return { ok: true, notice: "already_submitted" };
      }
    } else {
      const updated = await prisma.submission.updateMany({
        where: { id: submissionId, status: "DRAFT" },
        data: { payload: payload as unknown as Prisma.InputJsonValue },
      });
      if (updated.count !== 1) {
        await Promise.all(stored.map((item) => deleteObject(item.key).catch(() => undefined)));
        return { error: "not_draft" };
      }
    }
    for (const upload of stored) {
      await prisma.submissionFile.updateMany({
        where: { submissionId: submissionId, kind: upload.kind, isCurrent: true },
        data: { isCurrent: false },
      });
      await prisma.submissionFile.create({
        data: {
          submissionId: submissionId,
          kind: upload.kind,
          storageKey: upload.key,
          originalName: upload.name,
          size: upload.size,
          mime: upload.mime,
          isCurrent: true,
        },
      });
    }
    await applyLinks(submissionId, {
      PRODUCT: cleanUrl(data.productUrl) || "",
      GITHUB: cleanUrl(data.githubUrl) || "",
      VIDEO: cleanUrl(data.videoUrl) || "",
    });
  } catch {
    await Promise.all(stored.map((item) => deleteObject(item.key).catch(() => undefined)));
    return { error: "generic" };
  }
  revalidatePath(`/${locale}/cabinet`, "layout");
  return { ok: true };
}

export async function markNotification(formData: FormData) {
  const locale = localeOf(formData);
  const user = await requireUser(locale);
  const id = text(formData, "id");
  if (id === "all") {
    await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  } else {
    await prisma.notification.updateMany({ where: { id, userId: user.id, readAt: null }, data: { readAt: new Date() } });
  }
  revalidatePath(`/${locale}/cabinet/notifications`);
}
