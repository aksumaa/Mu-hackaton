"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { canScoreSubmission } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { scoreSubmission } from "@/lib/scoring";
import { requireUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { feedbackSchema } from "@/lib/validation";
import { checked, localeOf, text, type ActionState } from "@/server/action-state";

async function scoringContext(userId: string, submissionId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { assignments: true },
  });
  const stage = submission ? await prisma.stage.findUnique({ where: { key: submission.stageKey }, include: { criteria: true } }) : null;
  return { user, submission, stage };
}

export async function saveScore(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return persistScore(formData, false);
}

export async function finalizeScore(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return persistScore(formData, true);
}

async function persistScore(formData: FormData, finalize: boolean): Promise<ActionState> {
  const locale = localeOf(formData);
  const actor = await requireUser(locale);
  if (finalize && !checked(formData, "confirm")) return { error: "confirm_required" };
  const submissionId = text(formData, "submissionId");
  const { user, submission, stage } = await scoringContext(actor.id, submissionId);
  if (!user || !submission || !stage || submission.status === "DRAFT") return { error: "not_found" };
  const settings = await getSettings();
  let assignment = submission.assignments.find((item) => item.judgeId === user.id) ?? null;
  if (assignment?.conflictDeclared) return { error: "forbidden" };
  const allowed = canScoreSubmission({
    actor: { id: user.id, role: user.role, isActive: user.isActive },
    assigned: Boolean(assignment),
    conflictDeclared: Boolean(assignment?.conflictDeclared),
    judgesCanScoreAny: settings.judgesCanScoreAny,
    stageStatus: stage.status,
  });
  if (!allowed || user.role !== "JUDGE") return { error: "forbidden" };
  if (!assignment) {
    assignment = await prisma.judgeAssignment.create({
      data: { judgeId: user.id, submissionId: submission.id, status: "IN_PROGRESS" },
    });
  }
  const existing = await prisma.evaluation.findUnique({ where: { assignmentId: assignment.id } });
  if (existing?.finalizedAt) return { error: "finalized" };
  const scores = stage.criteria.map((criterion) => ({
    criterionId: criterion.id,
    points: Number(text(formData, `points_${criterion.id}`) || "0"),
  }));
  const strengths = [0, 1, 2].map((index) => text(formData, `strength_${index}`)).filter(Boolean);
  const improvements = [0, 1, 2].map((index) => text(formData, `improvement_${index}`)).filter(Boolean);
  const parsed = feedbackSchema.safeParse({
    strengths,
    improvements,
    nextSteps: text(formData, "nextSteps"),
    publicComment: text(formData, "publicComment"),
    internalNote: text(formData, "internalNote"),
    scores,
  });
  if (!parsed.success) return { error: "invalid_field" };
  if (finalize) {
    const scored = scoreSubmission(stage.criteria, parsed.data.scores);
    if (!scored.ok) return { error: scored.code === "range" || scored.code === "not_integer" ? "score_range" : "score_incomplete" };
  } else {
    for (const score of parsed.data.scores) {
      const criterion = stage.criteria.find((item) => item.id === score.criterionId);
      if (!criterion || !Number.isInteger(score.points) || score.points < 0 || score.points > criterion.maxPoints) {
        return { error: "score_range" };
      }
    }
  }
  const evaluation = await prisma.evaluation.upsert({
    where: { assignmentId: assignment.id },
    create: {
      assignmentId: assignment.id,
      strengths: parsed.data.strengths,
      improvements: parsed.data.improvements,
      nextSteps: parsed.data.nextSteps,
      publicComment: parsed.data.publicComment,
      internalNote: parsed.data.internalNote,
      finalizedAt: finalize ? new Date() : null,
    },
    update: {
      strengths: parsed.data.strengths,
      improvements: parsed.data.improvements,
      nextSteps: parsed.data.nextSteps,
      publicComment: parsed.data.publicComment,
      internalNote: parsed.data.internalNote,
      finalizedAt: finalize ? new Date() : null,
    },
  });
  await prisma.evaluationScore.deleteMany({ where: { evaluationId: evaluation.id } });
  if (parsed.data.scores.length > 0) {
    await prisma.evaluationScore.createMany({
      data: parsed.data.scores.map((score) => ({ evaluationId: evaluation.id, criterionId: score.criterionId, points: score.points })),
    });
  }
  await prisma.judgeAssignment.update({
    where: { id: assignment.id },
    data: { status: finalize ? "DONE" : "IN_PROGRESS" },
  });
  if (finalize) await audit({ actorId: user.id, action: "evaluation_finalized", entity: "Evaluation", entityId: evaluation.id });
  revalidatePath(`/${locale}/judge`, "layout");
  return { ok: true };
}

export async function declareConflict(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = localeOf(formData);
  const user = await requireUser(locale);
  if (user.role !== "JUDGE") return { error: "forbidden" };
  const note = text(formData, "conflictNote").trim();
  if (note.length < 3) return { error: "conflict_required", field: "conflictNote" };
  const submissionId = text(formData, "submissionId");
  const submission = await prisma.submission.findUnique({ where: { id: submissionId }, include: { assignments: true } });
  if (!submission || submission.status === "DRAFT") return { error: "not_found" };
  const assignment = submission.assignments.find((item) => item.judgeId === user.id);
  if (assignment) {
    const evaluation = await prisma.evaluation.findUnique({ where: { assignmentId: assignment.id } });
    if (evaluation?.finalizedAt) return { error: "finalized" };
  }
  const row = assignment
    ? await prisma.judgeAssignment.update({
        where: { id: assignment.id },
        data: { conflictDeclared: true, conflictNote: note },
      })
    : await prisma.judgeAssignment.create({
        data: { judgeId: user.id, submissionId, conflictDeclared: true, conflictNote: note },
      });
  await audit({ actorId: user.id, action: "conflict_declared", entity: "JudgeAssignment", entityId: row.id });
  revalidatePath(`/${locale}/judge`, "layout");
  return { ok: true };
}
