import "./../prisma/load-env";
import { prisma } from "../src/lib/prisma";

async function main() {
await prisma.user.updateMany({
  where: { role: "JUDGE", studentId: { notIn: ["MU-JUDGE-1", "MU-JUDGE-2", "MU-JUDGE-3"] } },
  data: { isActive: false },
});
const submissions = await prisma.submission.findMany({ where: { stageKey: "STAGE1" }, select: { id: true } });
const ids = submissions.map((submission) => submission.id);
await prisma.stageResult.deleteMany({ where: { stageKey: "STAGE1" } });
if (ids.length) {
  await prisma.evaluationScore.deleteMany({ where: { evaluation: { assignment: { submissionId: { in: ids } } } } });
  await prisma.evaluation.deleteMany({ where: { assignment: { submissionId: { in: ids } } } });
  await prisma.judgeAssignment.deleteMany({ where: { submissionId: { in: ids } } });
}
const leader = await prisma.user.findFirst({
  where: { studentId: "MU-24001" },
  include: { ledTeam: { include: { project: { include: { submissions: true } } } } },
});
const draftId = leader?.ledTeam?.project?.submissions.find((submission) => submission.stageKey === "STAGE1")?.id;
if (draftId) {
  await prisma.submission.update({
    where: { id: draftId },
    data: { status: "DRAFT", updateUsedAt: null, firstSubmittedAt: null },
  });
}
  const now = Date.now();
  const day = 86_400_000;
  await prisma.stage.update({
    where: { key: "STAGE1" },
    data: {
      status: "OPEN",
      opensAt: new Date(now - day),
      updateDeadlineAt: new Date(now + 5 * day),
      deadlineAt: new Date(now + 6 * day),
      resultsPublishedAt: null,
      revealScoresToJudges: false,
    },
  });
}

main().then(() => prisma.$disconnect()).catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
