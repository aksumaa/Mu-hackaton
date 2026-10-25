import { describe, expect, it } from "vitest";
import { advanceSelection, planRanking } from "@/lib/ranking";

describe("ranking publication rules", () => {
  it("flags a tie on the cutoff and requires an explicit choice", () => {
    const plan = planRanking({
      rows: [
        { id: "a", totals: [90] },
        { id: "b", totals: [80] },
        { id: "c", totals: [80] },
        { id: "d", totals: [70] },
      ],
      threshold: 20,
      mode: "average",
      judgesExpected: 1,
      topN: 2,
    });
    expect(plan.filter((row) => row.tie).map((row) => row.id).sort()).toEqual(["b", "c"]);
    expect(advanceSelection(plan, 2, ["b"]).advanced).toEqual(new Set(["a", "b"]));
    expect(advanceSelection(plan, 2, ["b", "c"]).ok).toBe(false);
  });

  it("marks a two-judge gap above the threshold", () => {
    const plan = planRanking({
      rows: [{ id: "a", totals: [90, 60] }],
      threshold: 20,
      mode: "average",
      judgesExpected: 2,
      topN: 1,
    });
    expect(plan[0]).toMatchObject({ avg: 75, needsThirdJudge: true, tie: false });
  });
});
