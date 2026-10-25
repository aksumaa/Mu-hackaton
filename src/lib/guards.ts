export type Actor = {
  id: string;
  role: "PARTICIPANT" | "JUDGE" | "ADMIN";
  isActive: boolean;
};

export function canAccessCabinet(actor: Actor | null) {
  return Boolean(actor?.isActive && actor.role === "PARTICIPANT");
}

export function canAccessJudge(actor: Actor | null) {
  return Boolean(actor?.isActive && (actor.role === "JUDGE" || actor.role === "ADMIN"));
}

export function canAccessAdmin(actor: Actor | null) {
  return Boolean(actor?.isActive && actor.role === "ADMIN");
}

export function canReadTeam(actor: Actor, team: { leaderId: string }) {
  if (!actor.isActive) return false;
  if (actor.role === "ADMIN") return true;
  return actor.role === "PARTICIPANT" && actor.id === team.leaderId;
}

export function canReadJudgeScore(
  actor: Actor,
  evaluationJudgeId: string,
  stage: { status: string; revealScoresToJudges: boolean },
) {
  if (!actor.isActive) return false;
  if (actor.role === "ADMIN") return true;
  if (actor.role !== "JUDGE") return false;
  if (evaluationJudgeId === actor.id) return true;
  return stage.status === "PUBLISHED" || stage.revealScoresToJudges;
}

export function canReadParticipantResults(actor: Actor, leaderId: string, stageStatus: string) {
  return actor.isActive && actor.role === "PARTICIPANT" && actor.id === leaderId && stageStatus === "PUBLISHED";
}

export function canScoreSubmission(input: {
  actor: Actor;
  assigned: boolean;
  conflictDeclared: boolean;
  judgesCanScoreAny: boolean;
  stageStatus: string;
}) {
  if (!input.actor.isActive || input.actor.role !== "JUDGE") return false;
  if (input.stageStatus !== "EVALUATING") return false;
  if (input.conflictDeclared) return false;
  return input.assigned || input.judgesCanScoreAny;
}
