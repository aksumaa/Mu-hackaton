import { describe, expect, it } from "vitest";
import { canAccessStoredFile, toPublicFeedback, visibleTeam } from "@/lib/files-access";

const participant = { id: "p1", role: "PARTICIPANT" as const, isActive: true };
const other = { id: "p2", role: "PARTICIPANT" as const, isActive: true };
const judge = { id: "j1", role: "JUDGE" as const, isActive: true };
const admin = { id: "a1", role: "ADMIN" as const, isActive: true };

describe("stored files are not public", () => {
  it("denies anonymous users and other teams, including draft files for judges", () => {
    expect(canAccessStoredFile({ actor: null, ownerId: "p1", submissionStatus: "SUBMITTED" })).toBe(false);
    expect(canAccessStoredFile({ actor: other, ownerId: "p1", submissionStatus: "SUBMITTED" })).toBe(false);
    expect(canAccessStoredFile({ actor: participant, ownerId: "p1", submissionStatus: "DRAFT" })).toBe(true);
    expect(canAccessStoredFile({ actor: judge, ownerId: "p1", submissionStatus: "DRAFT" })).toBe(false);
    expect(canAccessStoredFile({ actor: judge, ownerId: "p1", submissionStatus: "SUBMITTED" })).toBe(true);
    expect(canAccessStoredFile({ actor: admin, ownerId: "p1", submissionStatus: "DRAFT" })).toBe(true);
    expect(canAccessStoredFile({ actor: { ...judge, isActive: false }, ownerId: "p1", submissionStatus: "SUBMITTED" })).toBe(false);
  });

  it("hides team identity in blind review and strips internal judge notes", () => {
    expect(visibleTeam(true, { name: "Team", members: [{ fullName: "Ada" }] })).toEqual({ name: null, members: [] });
    const published = toPublicFeedback([
      {
        strengths: ["Clear problem"],
        improvements: ["Show evidence"],
        nextSteps: "Interview five users",
        publicComment: "Promising",
        internalNote: "Possible conflict",
        judgeId: "j1",
      },
    ]);
    expect(published).toEqual([
      {
        strengths: ["Clear problem"],
        improvements: ["Show evidence"],
        nextSteps: "Interview five users",
        publicComment: "Promising",
      },
    ]);
    expect(JSON.stringify(published)).not.toContain("internalNote");
    expect(JSON.stringify(published)).not.toContain("j1");
  });
});
