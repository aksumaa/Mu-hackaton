import type { Actor } from "@/lib/guards";

export function canAccessStoredFile(input: {
  actor: Actor | null;
  ownerId: string;
  submissionStatus: "DRAFT" | "SUBMITTED" | "UPDATED" | "LOCKED";
}) {
  const actor = input.actor;
  if (!actor?.isActive) return false;
  if (actor.role === "ADMIN") return true;
  if (actor.role === "PARTICIPANT") return actor.id === input.ownerId;
  if (actor.role === "JUDGE") return input.submissionStatus !== "DRAFT";
  return false;
}

export function visibleTeam<T extends { name: string | null; members: { fullName: string }[] }>(blind: boolean, team: T): T {
  if (!blind) return team;
  return { ...team, name: null, members: [] };
}

export function toPublicFeedback(
  evaluations: {
    strengths: string[];
    improvements: string[];
    nextSteps: string;
    publicComment: string;
    internalNote?: string;
    judgeId?: string;
  }[],
) {
  return evaluations.map((evaluation) => ({
    strengths: evaluation.strengths,
    improvements: evaluation.improvements,
    nextSteps: evaluation.nextSteps,
    publicComment: evaluation.publicComment,
  }));
}
