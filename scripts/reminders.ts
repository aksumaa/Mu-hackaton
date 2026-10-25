import { prisma } from "../src/lib/prisma";
import { notifyUser } from "../src/lib/notify";

async function main() {
const horizon = new Date(Date.now() + 24 * 60 * 60 * 1000);
const stages = await prisma.stage.findMany({
  where: { status: "OPEN", deadlineAt: { gt: new Date(), lte: horizon } },
});

for (const stage of stages) {
  const submissions = await prisma.submission.findMany({
    where: { stageKey: stage.key, status: { in: ["DRAFT", "SUBMITTED"] } },
    include: { project: { include: { team: true } } },
  });
  for (const submission of submissions) {
    if (submission.status === "SUBMITTED" && submission.updateUsedAt) continue;
    await notifyUser({
      userId: submission.project.team.leaderId,
      type: "reminder",
      titleKey: "notifications.reminder",
      payload: { stage: stage.key },
    });
  }
}

}
main().finally(() => prisma.$disconnect());
