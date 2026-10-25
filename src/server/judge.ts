import type { FileKind, StageKey } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { canScoreSubmission } from "@/lib/guards";
import { getSettings } from "@/lib/settings";
import { scoreSubmission } from "@/lib/scoring";
import { feedbackSchema } from "@/lib/validation";
import { extensionAllowed, matchesKind } from "@/lib/file-magic";
import { newStorageKey, putObject } from "@/lib/storage";
import { scanFile } from "@/lib/virus-scan";
import { evaluateWrite } from "@/lib/deadlines";
import type { ActionResult } from "@/server/participant";

export async function saveJudgeScore(input: {
  judgeId: string;
  submissionId: string;
  raw: unknown;
  finalize: boolean;
}): Promise<ActionResult<{ total: number }>> {
  const settings = await getSettings();
  const submission = await prisma.submission.findUnique({
    where: { id: input.submissionId },
    include: { assignments: true },
  });
  if (!submission || submission.status === "DRAFT") return { ok: false, code: "not_found" };
  const stage = await prisma.stage.findUnique({ where: { key: submission.stageKey } });
  if (!stage) return { ok: false, code: "not_found" };
  let assignment = submission.assignments.find((item) => item.judgeId === input.judgeId) ?? null;
  if (!assignment && settings.judgesCanScoreAny) {
    assignment = await prisma.judgeAssignment.create({
      data: { judgeId: input.judgeId, submissionId: submission.id },
    });
  }
  if (!assignment) return { ok: false, code: "not_assigned" };
  const allowed = canScoreSubmission({
    actor: { id: input.judgeId, role: "JUDGE", isActive: true },
    assigned: true,
    conflictDeclared: assignment.conflictDeclared,
    judgesCanScoreAny: settings.judgesCanScoreAny,
    stageStatus: stage.status,
  });
  if (!allowed) return { ok: false, code: assignment.conflictDeclared ? "conflict_declared" : "scoring_closed" };
  const existing = await prisma.evaluation.findUnique({ where: { assignmentId: assignment.id } });
  if (existing?.finalizedAt) return { ok: false, code: "finalized" };
  const parsed = feedbackSchema.safeParse(input.raw);
  if (!parsed.success) return { ok: false, code: "invalid_input" };
  const criteria = await prisma.criterion.findMany({ where: { stageKey: submission.stageKey } });
  if (input.finalize) {
    const scored = scoreSubmission(criteria, parsed.data.scores);
    if (!scored.ok) return { ok: false, code: scored.code === "range" ? "range" : "incomplete" };
    await prisma.$transaction(async (tx) => {
      const evaluation = await tx.evaluation.upsert({
        where: { assignmentId: assignment.id },
        create: {
          assignmentId: assignment.id,
          strengths: parsed.data.strengths,
          improvements: parsed.data.improvements,
          nextSteps: parsed.data.nextSteps,
          publicComment: parsed.data.publicComment,
          internalNote: parsed.data.internalNote,
          finalizedAt: new Date(),
        },
        update: {
          strengths: parsed.data.strengths,
          improvements: parsed.data.improvements,
          nextSteps: parsed.data.nextSteps,
          publicComment: parsed.data.publicComment,
          internalNote: parsed.data.internalNote,
          finalizedAt: new Date(),
        },
      });
      await tx.evaluationScore.deleteMany({ where: { evaluationId: evaluation.id } });
      await tx.evaluationScore.createMany({
        data: parsed.data.scores.map((score) => ({ evaluationId: evaluation.id, criterionId: score.criterionId, points: score.points })),
      });
      await tx.judgeAssignment.update({ where: { id: assignment.id }, data: { status: "DONE" } });
    });
    await audit({ actorId: input.judgeId, action: "finalize_score", entity: "Submission", entityId: submission.id });
    return { ok: true, data: { total: scoreSubmission(criteria, parsed.data.scores).ok ? (scoreSubmission(criteria, parsed.data.scores) as { total: number }).total : 0 } };
  }
  for (const score of parsed.data.scores) {
    const criterion = criteria.find((item) => item.id === score.criterionId);
    if (!criterion || !Number.isInteger(score.points) || score.points < 0 || score.points > criterion.maxPoints) {
      return { ok: false, code: "range" };
    }
  }
  const partial = scoreSubmission(
    criteria.filter((criterion) => parsed.data.scores.some((score) => score.criterionId === criterion.id)),
    parsed.data.scores,
  );
  await prisma.$transaction(async (tx) => {
    const evaluation = await tx.evaluation.upsert({
      where: { assignmentId: assignment.id },
      create: {
        assignmentId: assignment.id,
        strengths: parsed.data.strengths,
        improvements: parsed.data.improvements,
        nextSteps: parsed.data.nextSteps,
        publicComment: parsed.data.publicComment,
        internalNote: parsed.data.internalNote,
      },
      update: {
        strengths: parsed.data.strengths,
        improvements: parsed.data.improvements,
        nextSteps: parsed.data.nextSteps,
        publicComment: parsed.data.publicComment,
        internalNote: parsed.data.internalNote,
      },
    });
    await tx.evaluationScore.deleteMany({ where: { evaluationId: evaluation.id } });
    if (parsed.data.scores.length) {
      await tx.evaluationScore.createMany({
        data: parsed.data.scores.map((score) => ({ evaluationId: evaluation.id, criterionId: score.criterionId, points: score.points })),
      });
    }
    await tx.judgeAssignment.update({ where: { id: assignment.id }, data: { status: "IN_PROGRESS" } });
  });
  return { ok: true, data: { total: partial.ok ? partial.total : parsed.data.scores.reduce((sum, score) => sum + score.points, 0) } };
}

export async function declareConflict(judgeId: string, submissionId: string, note: string): Promise<ActionResult> {
  const assignment = await prisma.judgeAssignment.findUnique({
    where: { judgeId_submissionId: { judgeId, submissionId } },
    include: { evaluation: true },
  });
  if (!assignment) return { ok: false, code: "not_assigned" };
  if (assignment.evaluation?.finalizedAt) return { ok: false, code: "finalized" };
  if (!note.trim()) return { ok: false, code: "invalid_input" };
  await prisma.judgeAssignment.update({
    where: { id: assignment.id },
    data: { conflictDeclared: true, conflictNote: note.trim().slice(0, 1000), status: "DONE" },
  });
  await audit({ actorId: judgeId, action: "declare_conflict", entity: "JudgeAssignment", entityId: assignment.id });
  return { ok: true, data: null };
}

export async function storeSubmissionFile(input: {
  userId: string;
  role: "PARTICIPANT" | "JUDGE" | "ADMIN";
  submissionId: string;
  kind: FileKind;
  name: string;
  mime: string;
  bytes: Buffer;
}): Promise<ActionResult<{ fileId: string }>> {
  if (input.role !== "PARTICIPANT") return { ok: false, code: "forbidden" };
  const submission = await prisma.submission.findFirst({
    where: { id: input.submissionId, project: { team: { leaderId: input.userId } } },
  });
  if (!submission) return { ok: false, code: "not_found" };
  const stage = await prisma.stage.findUnique({ where: { key: submission.stageKey } });
  if (!stage) return { ok: false, code: "not_found" };
  const intent = submission.status === "DRAFT" ? "save_draft" : "update";
  const decision = evaluateWrite(new Date(), stage, submission, intent);
  if (!decision.ok) {
    await audit({ actorId: input.userId, action: "deadline_rejected", entity: "Submission", entityId: submission.id, meta: { code: decision.code } });
    return decision;
  }
  const settings = await getSettings();
  if (input.kind === "VIDEO_FILE" && !settings.videoUploadEnabled) return { ok: false, code: "video_disabled" };
  const max = (settings.maxFileMb[input.kind] ?? 15) * 1024 * 1024;
  if (input.bytes.length > max) return { ok: false, code: "file_size" };
  if (!extensionAllowed(input.kind, input.name) || !(await matchesKind(input.kind, input.mime, input.bytes))) {
    return { ok: false, code: "file_type" };
  }
  const scan = await scanFile(input.bytes);
  if (!scan.clean) return { ok: false, code: "virus_detected" };
  const storageKey = newStorageKey(`submissions/${submission.id}/${input.kind}`);
  await putObject(storageKey, input.bytes, input.mime);
  const pending = submission.status !== "DRAFT";
  if (!pending) {
    await prisma.submissionFile.updateMany({
      where: { submissionId: submission.id, kind: input.kind, isCurrent: true },
      data: { isCurrent: false },
    });
  }
  const file = await prisma.submissionFile.create({
    data: {
      submissionId: submission.id,
      kind: input.kind,
      storageKey,
      originalName: input.name.slice(0, 180),
      size: input.bytes.length,
      mime: input.mime,
      isCurrent: !pending,
      pending,
    },
  });
  return { ok: true, data: { fileId: file.id } };
}

export async function activeJudgeStage() {
  const evaluating = await prisma.stage.findFirst({ where: { status: "EVALUATING" }, orderBy: { key: "asc" } });
  if (evaluating) return evaluating;
  const open = await prisma.stage.findFirst({ where: { status: "OPEN" }, orderBy: { key: "asc" } });
  if (open) return open;
  return prisma.stage.findFirst({ where: { status: { not: "DRAFT" } }, orderBy: { deadlineAt: "desc" } });
}

export type { StageKey };
