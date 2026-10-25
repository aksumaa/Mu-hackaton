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

export function canReadTeam(actor: Actor, team: { leaderId: string; memberIds?: string[] }) {
  if (!actor.isActive) return false;
  if (actor.role === "ADMIN") return true;
  if (actor.role !== "PARTICIPANT") return false;
  return actor.id === team.leaderId || Boolean(team.memberIds?.includes(actor.id));
}

export function canSubmitTeam(actor: Actor, team: { leaderId: string }) {
  return actor.isActive && actor.role === "PARTICIPANT" && actor.id === team.leaderId;
}

export function canResetMemberPassword(actor: Actor, team: { leaderId: string }) {
  return canSubmitTeam(actor, team);
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

export function canReadParticipantResults(actor: Actor, team: { leaderId: string; memberIds?: string[] }, stageStatus: string) {
  if (!actor.isActive || actor.role !== "PARTICIPANT" || stageStatus !== "PUBLISHED") return false;
  return actor.id === team.leaderId || Boolean(team.memberIds?.includes(actor.id));
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
