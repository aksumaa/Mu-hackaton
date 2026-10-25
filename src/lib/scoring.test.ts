import { describe, expect, it } from "vitest";
import { aggregate, boundaryTieIds, hasDiscrepancy, rankByAverage, rubricTotal, scoreSubmission } from "@/lib/scoring";
import { STAGE1_CRITERIA, STAGE2_CRITERIA, FINAL_CRITERIA } from "@/lib/catalog";

const criteria = [
  { id: "a", key: "a", maxPoints: 25 },
  { id: "b", key: "b", maxPoints: 75 },
];

describe("scoreSubmission", () => {
  it("sums integers inside each maximum and rejects client totals that skip a criterion", () => {
    expect(scoreSubmission(criteria, [
      { criterionId: "a", points: 25 },
      { criterionId: "b", points: 75 },
    ])).toEqual({ ok: true, total: 100 });
    expect(scoreSubmission(criteria, [{ criterionId: "a", points: 10 }]).ok).toBe(false);
  });

  it("rejects values outside 0..max, fractions, and unknown criteria", () => {
    expect(scoreSubmission(criteria, [
      { criterionId: "a", points: 26 },
      { criterionId: "b", points: 0 },
    ]).ok).toBe(false);
    expect(scoreSubmission(criteria, [
      { criterionId: "a", points: 1.5 },
      { criterionId: "b", points: 0 },
    ]).ok).toBe(false);
    expect(scoreSubmission(criteria, [
      { criterionId: "missing", points: 1 },
      { criterionId: "b", points: 0 },
    ]).ok).toBe(false);
  });
});

describe("aggregation and ranking", () => {
  it("averages and takes the median without trusting a precomputed total", () => {
    expect(aggregate([80, 60], "average")).toBe(70);
    expect(aggregate([10, 40, 70], "median")).toBe(40);
    expect(aggregate([10, 20, 30, 40], "median")).toBe(25);
  });

  it("flags a pair that differs by more than the threshold", () => {
    expect(hasDiscrepancy([80, 59], 20)).toBe(true);
    expect(hasDiscrepancy([80, 60], 20)).toBe(false);
    expect(hasDiscrepancy([90, 80, 60], 20)).toBe(true);
  });

  it("shares ranks on equal averages and does not break a cutoff tie", () => {
    const ranked = rankByAverage([
      { id: "a", avg: 90 },
      { id: "b", avg: 80 },
      { id: "c", avg: 80 },
      { id: "d", avg: 70 },
    ]);
    expect(ranked.map((row) => [row.id, row.rank])).toEqual([
      ["a", 1],
      ["b", 2],
      ["c", 2],
      ["d", 4],
    ]);
    expect(boundaryTieIds(ranked, 2).sort()).toEqual(["b", "c"]);
    expect(boundaryTieIds(ranked, 1)).toEqual([]);
    expect(boundaryTieIds(ranked, 3)).toEqual([]);
    expect(boundaryTieIds(ranked, 20)).toEqual([]);
  });
});

describe("seeded rubrics", () => {
  it("matches the regulation point totals", () => {
    expect(rubricTotal(STAGE1_CRITERIA)).toBe(100);
    expect(rubricTotal(STAGE2_CRITERIA)).toBe(100);
    expect(rubricTotal(FINAL_CRITERIA)).toBe(100);
    expect(new Set(STAGE1_CRITERIA.map((item) => item.key)).size).toBe(STAGE1_CRITERIA.length);
  });
});
