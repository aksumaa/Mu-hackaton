import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";
import { csvEscape } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user || user.role !== "ADMIN") return new Response(null, { status: 404 });
  const type = new URL(request.url).searchParams.get("type");
  let rows: (string | number | boolean)[][] = [];
  if (type === "people") {
    const people = await prisma.teamMember.findMany({ include: { faculty: true, team: true } });
    rows = [["studentId", "fullName", "faculty", "group", "status", "team"], ...people.map((person) => [person.studentId, person.fullName, person.faculty.nameEn, person.groupName, person.verificationStatus, person.team.name ?? ""])];
  } else if (type === "ranking") {
    const results = await prisma.stageResult.findMany({ include: { submission: { include: { project: true } } }, orderBy: [{ stageKey: "asc" }, { rank: "asc" }] });
    rows = [["stage", "rank", "title", "average", "advanced"], ...results.map((result) => [result.stageKey, result.rank, result.submission.project.title, result.avgTotal, result.advanced])];
  } else if (type === "scores") {
    const scores = await prisma.evaluationScore.findMany({ include: { criterion: true, evaluation: { include: { assignment: { include: { judge: true, submission: { include: { project: true } } } } } } } });
    rows = [["stage", "project", "criterion", "points", "max", "finalized"], ...scores.map((score) => [score.criterion.stageKey, score.evaluation.assignment.submission.project.title, score.criterion.key, score.points, score.criterion.maxPoints, Boolean(score.evaluation.finalizedAt)])];
  } else {
    return new Response(null, { status: 404 });
  }
  const csv = rows.map((row) => row.map((cell) => csvEscape(cell)).join(",")).join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${type}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
