export type StageWindow = {
  status: "DRAFT" | "OPEN" | "CLOSED" | "EVALUATING" | "PUBLISHED";
  opensAt: Date;
  deadlineAt: Date;
  updateDeadlineAt: Date;
};

export type SubmissionState = {
  status: "DRAFT" | "SUBMITTED" | "UPDATED" | "LOCKED";
  updateUsedAt: Date | null;
} | null;

export type WriteIntent = "save_draft" | "submit" | "update";

export type WriteDecision = { ok: true } | { ok: false; code: WriteDenial };

export type WriteDenial =
  | "stage_not_open"
  | "deadline_passed"
  | "locked"
  | "not_draft"
  | "already_submitted"
  | "update_not_available"
  | "update_used"
  | "update_deadline_passed";

export function evaluateWrite(
  now: Date,
  stage: StageWindow,
  submission: SubmissionState,
  intent: WriteIntent,
): WriteDecision {
  if (stage.status !== "OPEN" || now < stage.opensAt) return { ok: false, code: "stage_not_open" };
  if (now > stage.deadlineAt) return { ok: false, code: "deadline_passed" };

  const status = submission?.status ?? "DRAFT";
  if (status === "LOCKED" || status === "UPDATED") return { ok: false, code: "locked" };

  if (intent === "save_draft") {
    if (status !== "DRAFT") return { ok: false, code: "not_draft" };
    return { ok: true };
  }

  if (intent === "submit") {
    if (status !== "DRAFT") return { ok: false, code: "already_submitted" };
    return { ok: true };
  }

  if (status !== "SUBMITTED") return { ok: false, code: "update_not_available" };
  if (submission?.updateUsedAt) return { ok: false, code: "update_used" };
  if (now > stage.updateDeadlineAt) return { ok: false, code: "update_deadline_passed" };
  return { ok: true };
}

export function interpretSubmit(decision: WriteDecision): { ok: true; idempotent: boolean } | { ok: false; code: WriteDenial } {
  if (decision.ok) return { ok: true, idempotent: false };
  if (decision.code === "already_submitted") return { ok: true, idempotent: true };
  return decision;
}

export function pickActiveStage<T extends { status: StageWindow["status"]; opensAt: Date; deadlineAt: Date }>(
  stages: T[],
  now = new Date(),
): T | null {
  const soonest = (left: T, right: T) => left.deadlineAt.getTime() - right.deadlineAt.getTime();
  const evaluating = stages.filter((stage) => stage.status === "EVALUATING").sort(soonest);
  if (evaluating[0]) return evaluating[0];
  const open = stages.filter((stage) => stage.status === "OPEN").sort(soonest);
  const live = open.find((stage) => stage.opensAt <= now && now <= stage.deadlineAt);
  if (live) return live;
  const upcoming = open.find((stage) => stage.opensAt > now);
  if (upcoming) return upcoming;
  if (open[0]) return open[0];
  const finished = stages
    .filter((stage) => stage.status === "CLOSED" || stage.status === "PUBLISHED")
    .sort((left, right) => right.deadlineAt.getTime() - left.deadlineAt.getTime());
  return finished[0] ?? null;
}

export function submissionMode(now: Date, stage: StageWindow, submission: SubmissionState): "draft" | "update" | "locked" {
  const windowClosed = stage.status !== "OPEN" || now < stage.opensAt || now > stage.deadlineAt;
  if (windowClosed) return "locked";
  const status = submission?.status ?? "DRAFT";
  if (status === "DRAFT") return "draft";
  if (status === "SUBMITTED" && !submission?.updateUsedAt && now <= stage.updateDeadlineAt) return "update";
  return "locked";
}

export function lockReason(now: Date, stage: StageWindow, submission: SubmissionState) {
  if (!submission) return null;
  if (submission.status === "LOCKED" || submission.status === "UPDATED") return submission.status;
  if (stage.status !== "OPEN" || now > stage.deadlineAt) return "deadline" as const;
  if (submission.status === "SUBMITTED" && (submission.updateUsedAt || now > stage.updateDeadlineAt)) {
    return "update_closed" as const;
  }
  return null;
}
