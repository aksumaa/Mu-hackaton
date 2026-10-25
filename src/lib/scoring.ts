import { round2 } from "@/lib/utils";

export type CriterionDef = { id: string; key: string; maxPoints: number };
export type ScoreInput = { criterionId: string; points: number };

export type ScoreResult =
  | { ok: true; total: number }
  | { ok: false; code: "missing" | "unknown" | "range" | "not_integer" | "duplicate"; criterionId?: string };

export function scoreSubmission(criteria: CriterionDef[], scores: ScoreInput[]): ScoreResult {
  const seen = new Set<string>();
  const byId = new Map(criteria.map((criterion) => [criterion.id, criterion]));
  let total = 0;

  for (const score of scores) {
    if (seen.has(score.criterionId)) {
      return { ok: false, code: "duplicate", criterionId: score.criterionId };
    }
    seen.add(score.criterionId);
    const criterion = byId.get(score.criterionId);
    if (!criterion) return { ok: false, code: "unknown", criterionId: score.criterionId };
    if (!Number.isInteger(score.points)) {
      return { ok: false, code: "not_integer", criterionId: score.criterionId };
    }
    if (score.points < 0 || score.points > criterion.maxPoints) {
      return { ok: false, code: "range", criterionId: score.criterionId };
    }
    total += score.points;
  }

  for (const criterion of criteria) {
    if (!seen.has(criterion.id)) return { ok: false, code: "missing", criterionId: criterion.id };
  }

  return { ok: true, total };
}

export function aggregate(values: number[], mode: "average" | "median") {
  if (values.length === 0) return null;
  if (mode === "median") {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 1) return round2(sorted[mid]!);
    return round2((sorted[mid - 1]! + sorted[mid]!) / 2);
  }
  return round2(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function hasDiscrepancy(totals: number[], threshold: number) {
  for (let i = 0; i < totals.length; i += 1) {
    for (let j = i + 1; j < totals.length; j += 1) {
      if (Math.abs(totals[i]! - totals[j]!) > threshold) return true;
    }
  }
  return false;
}

export type RankedRow = { id: string; avg: number; rank: number };

export function rankByAverage(items: { id: string; avg: number }[]): RankedRow[] {
  const sorted = [...items].sort((a, b) => b.avg - a.avg || a.id.localeCompare(b.id));
  const ranked: RankedRow[] = [];
  sorted.forEach((item, index) => {
    const previous = sorted[index - 1];
    const rank = previous && previous.avg === item.avg ? ranked[index - 1]!.rank : index + 1;
    ranked.push({ id: item.id, avg: item.avg, rank });
  });
  return ranked;
}

export function boundaryTieIds(ranked: RankedRow[], topN: number) {
  if (topN <= 0 || ranked.length === 0) return [] as string[];
  const sorted = [...ranked].sort((a, b) => b.avg - a.avg || a.id.localeCompare(b.id));
  const cutoff = sorted[Math.min(topN, sorted.length) - 1];
  if (!cutoff) return [];
  const group = sorted.filter((row) => row.avg === cutoff.avg);
  if (group.length < 2) return [];
  const above = sorted.filter((row) => row.avg > cutoff.avg).length;
  const slots = topN - above;
  if (slots <= 0 || slots >= group.length) return [];
  return group.map((row) => row.id);
}

export function rubricTotal(criteria: { maxPoints: number }[]) {
  return criteria.reduce((sum, criterion) => sum + criterion.maxPoints, 0);
}
