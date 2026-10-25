import { describe, expect, it } from "vitest";
import { evaluateWrite, interpretSubmit, pickActiveStage, submissionMode } from "@/lib/deadlines";

const opensAt = new Date("2026-10-01T00:00:00.000Z");
const updateDeadlineAt = new Date("2026-10-07T18:59:59.000Z");
const deadlineAt = new Date("2026-10-08T18:59:59.000Z");

const open = {
  status: "OPEN" as const,
  opensAt,
  deadlineAt,
  updateDeadlineAt,
};

describe("submission windows", () => {
  it("allows a draft save and submit one second before the deadline", () => {
    const now = new Date(deadlineAt.getTime() - 1000);
    expect(evaluateWrite(now, open, { status: "DRAFT", updateUsedAt: null }, "save_draft").ok).toBe(true);
    expect(evaluateWrite(now, open, { status: "DRAFT", updateUsedAt: null }, "submit").ok).toBe(true);
  });

  it("treats the deadline instant as still open and the next millisecond as late", () => {
    expect(evaluateWrite(deadlineAt, open, { status: "DRAFT", updateUsedAt: null }, "submit").ok).toBe(true);
    expect(evaluateWrite(new Date(deadlineAt.getTime() + 1), open, { status: "DRAFT", updateUsedAt: null }, "submit").ok).toBe(
      false,
    );
    expect(evaluateWrite(updateDeadlineAt, open, { status: "SUBMITTED", updateUsedAt: null }, "update").ok).toBe(true);
    expect(
      evaluateWrite(new Date(updateDeadlineAt.getTime() + 1), open, { status: "SUBMITTED", updateUsedAt: null }, "update").ok,
    ).toBe(false);
  });

  it("rejects every write one second after the deadline", () => {
    const now = new Date(deadlineAt.getTime() + 1000);
    expect(evaluateWrite(now, open, { status: "DRAFT", updateUsedAt: null }, "submit")).toEqual({
      ok: false,
      code: "deadline_passed",
    });
    expect(evaluateWrite(now, open, { status: "SUBMITTED", updateUsedAt: null }, "update").ok).toBe(false);
  });

  it("allows one update before the update deadline and blocks the second", () => {
    const now = new Date(updateDeadlineAt.getTime() - 1000);
    expect(evaluateWrite(now, open, { status: "SUBMITTED", updateUsedAt: null }, "update").ok).toBe(true);
    expect(evaluateWrite(now, open, { status: "SUBMITTED", updateUsedAt: now }, "update")).toEqual({
      ok: false,
      code: "update_used",
    });
    expect(evaluateWrite(now, open, { status: "UPDATED", updateUsedAt: now }, "update")).toEqual({
      ok: false,
      code: "locked",
    });
  });

  it("rejects an update one second after the update deadline even if the main deadline is open", () => {
    const now = new Date(updateDeadlineAt.getTime() + 1000);
    expect(evaluateWrite(now, open, { status: "SUBMITTED", updateUsedAt: null }, "update")).toEqual({
      ok: false,
      code: "update_deadline_passed",
    });
    expect(evaluateWrite(now, open, { status: "DRAFT", updateUsedAt: null }, "submit").ok).toBe(true);
  });

  it("treats a repeated submit as idempotent success", () => {
    const decision = evaluateWrite(opensAt, open, { status: "SUBMITTED", updateUsedAt: null }, "submit");
    expect(interpretSubmit(decision)).toEqual({ ok: true, idempotent: true });
  });

  it("rejects writes when the stage is not open", () => {
    expect(evaluateWrite(opensAt, { ...open, status: "EVALUATING" }, null, "save_draft").ok).toBe(false);
  });

  it("prefers the stage being scored over a later stage that is only open", () => {
    const now = new Date("2026-10-25T12:00:00.000Z");
    const picked = pickActiveStage([
      { status: "OPEN", opensAt: new Date("2026-11-05T00:00:00.000Z"), deadlineAt: new Date("2026-11-20T00:00:00.000Z"), key: "STAGE2" },
      { status: "EVALUATING", opensAt: new Date("2026-10-01T00:00:00.000Z"), deadlineAt: new Date("2026-10-20T00:00:00.000Z"), key: "STAGE1" },
    ], now);
    expect(picked?.key).toBe("STAGE1");
  });

  it("locks the form one second after either deadline and keeps it open one second before", () => {
    const beforeDeadline = new Date(deadlineAt.getTime() - 1000);
    const afterDeadline = new Date(deadlineAt.getTime() + 1000);
    const beforeUpdate = new Date(updateDeadlineAt.getTime() - 1000);
    const afterUpdate = new Date(updateDeadlineAt.getTime() + 1000);
    expect(submissionMode(beforeDeadline, open, { status: "DRAFT", updateUsedAt: null })).toBe("draft");
    expect(submissionMode(deadlineAt, open, { status: "DRAFT", updateUsedAt: null })).toBe("draft");
    expect(submissionMode(afterDeadline, open, { status: "DRAFT", updateUsedAt: null })).toBe("locked");
    expect(submissionMode(beforeUpdate, open, { status: "SUBMITTED", updateUsedAt: null })).toBe("update");
    expect(submissionMode(afterUpdate, open, { status: "SUBMITTED", updateUsedAt: null })).toBe("locked");
    expect(submissionMode(beforeUpdate, open, { status: "SUBMITTED", updateUsedAt: beforeUpdate })).toBe("locked");
    expect(submissionMode(beforeDeadline, open, { status: "UPDATED", updateUsedAt: beforeUpdate })).toBe("locked");
  });
});
