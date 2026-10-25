import { aggregate, boundaryTieIds, hasDiscrepancy, rankByAverage } from "@/lib/scoring";

export type PlanRow = {
  id: string;
  avg: number;
  rank: number;
  needsThirdJudge: boolean;
  short: boolean;
  tie: boolean;
};

export function planRanking(input: {
  rows: { id: string; totals: number[] }[];
  threshold: number;
  mode: "average" | "median";
  judgesExpected: number;
  topN: number;
}) {
  const scored = input.rows
    .filter((row) => row.totals.length > 0)
    .map((row) => ({
      id: row.id,
      avg: aggregate(row.totals, input.mode) ?? 0,
      needsThirdJudge: row.totals.length >= 2 && hasDiscrepancy(row.totals, input.threshold),
      short: row.totals.length < input.judgesExpected,
    }));
  const ranked = rankByAverage(scored.map((row) => ({ id: row.id, avg: row.avg })));
  const ties = new Set(boundaryTieIds(ranked, input.topN));
  return ranked.map((row) => {
    const extra = scored.find((item) => item.id === row.id)!;
    return {
      id: row.id,
      avg: row.avg,
      rank: row.rank,
      needsThirdJudge: extra.needsThirdJudge,
      short: extra.short,
      tie: ties.has(row.id),
    } satisfies PlanRow;
  });
}

export function advanceSelection(plan: { id: string; avg: number; tie: boolean }[], topN: number, chosenTieIds: string[]) {
  const tieRows = plan.filter((row) => row.tie);
  if (tieRows.length === 0) {
    const sorted = [...plan].sort((a, b) => b.avg - a.avg || a.id.localeCompare(b.id));
    return { ok: true as const, advanced: new Set(sorted.slice(0, topN).map((row) => row.id)) };
  }
  const tieAvg = tieRows[0]!.avg;
  const automatic = plan.filter((row) => row.avg > tieAvg).map((row) => row.id);
  const slots = topN - automatic.length;
  if (slots <= 0) return { ok: true as const, advanced: new Set(automatic) };
  if (slots >= tieRows.length) return { ok: true as const, advanced: new Set([...automatic, ...tieRows.map((row) => row.id)]) };
  const unique = [...new Set(chosenTieIds)];
  const allowed = new Set(tieRows.map((row) => row.id));
  if (slots < 0 || unique.length !== slots || unique.some((id) => !allowed.has(id))) {
    return { ok: false as const, code: "tie_unresolved" as const, slots, choices: [...allowed] };
  }
  return { ok: true as const, advanced: new Set([...automatic, ...unique]) };
}

export function averageCriteria(
  criteria: { id: string }[],
  evaluations: { points: { criterionId: string; points: number }[] }[],
  mode: "average" | "median",
) {
  return criteria.map((criterion) => {
    const values = evaluations
      .map((evaluation) => evaluation.points.find((score) => score.criterionId === criterion.id)?.points)
      .filter((value): value is number => value != null);
    return { criterionId: criterion.id, avg: values.length ? (aggregate(values, mode) ?? 0) : 0 };
  });
}
