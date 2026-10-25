import { describe, expect, it } from "vitest";
import {
  canAccessAdmin,
  canReadJudgeScore,
  canReadParticipantResults,
  canReadTeam,
  canScoreSubmission,
} from "@/lib/guards";

const participant = { id: "p1", role: "PARTICIPANT" as const, isActive: true };
const other = { id: "p2", role: "PARTICIPANT" as const, isActive: true };
const judge = { id: "j1", role: "JUDGE" as const, isActive: true };
const admin = { id: "a1", role: "ADMIN" as const, isActive: true };

describe("authorization", () => {
  it("lets a participant read only their own team", () => {
    expect(canReadTeam(participant, { leaderId: "p1" })).toBe(true);
    expect(canReadTeam(participant, { leaderId: "p2" })).toBe(false);
    expect(canReadTeam(other, { leaderId: "p1" })).toBe(false);
    expect(canReadTeam(admin, { leaderId: "p1" })).toBe(true);
    expect(canReadTeam(judge, { leaderId: "p1" })).toBe(false);
  });

  it("hides another judge's scores until publish or an explicit reveal", () => {
    const hidden = { status: "EVALUATING", revealScoresToJudges: false };
    expect(canReadJudgeScore(judge, "j2", hidden)).toBe(false);
    expect(canReadJudgeScore(judge, "j1", hidden)).toBe(true);
    expect(canReadJudgeScore(judge, "j2", { status: "PUBLISHED", revealScoresToJudges: false })).toBe(true);
    expect(canReadJudgeScore(judge, "j2", { status: "EVALUATING", revealScoresToJudges: true })).toBe(true);
    expect(canReadJudgeScore(participant, "j1", hidden)).toBe(false);
    expect(canReadJudgeScore(admin, "j2", hidden)).toBe(true);
  });

  it("shows participant results only to the leader after publication", () => {
    expect(canReadParticipantResults(participant, "p1", "PUBLISHED")).toBe(true);
    expect(canReadParticipantResults(participant, "p1", "EVALUATING")).toBe(false);
    expect(canReadParticipantResults(other, "p1", "PUBLISHED")).toBe(false);
  });

  it("scores only assigned judges during evaluation unless the setting allows any judge", () => {
    expect(canScoreSubmission({
      actor: judge,
      assigned: true,
      conflictDeclared: false,
      judgesCanScoreAny: false,
      stageStatus: "EVALUATING",
    })).toBe(true);
    expect(canScoreSubmission({
      actor: judge,
      assigned: false,
      conflictDeclared: false,
      judgesCanScoreAny: false,
      stageStatus: "EVALUATING",
    })).toBe(false);
    expect(canScoreSubmission({
      actor: judge,
      assigned: false,
      conflictDeclared: false,
      judgesCanScoreAny: true,
      stageStatus: "EVALUATING",
    })).toBe(true);
    expect(canScoreSubmission({
      actor: judge,
      assigned: true,
      conflictDeclared: true,
      judgesCanScoreAny: true,
      stageStatus: "EVALUATING",
    })).toBe(false);
    expect(canAccessAdmin(participant)).toBe(false);
    expect(canAccessAdmin(admin)).toBe(true);
  });
});
