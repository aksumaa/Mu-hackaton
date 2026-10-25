import { prisma } from "@/lib/prisma";

export function loadCabinet(userId: string) {
  return prisma.team.findUnique({
    where: { leaderId: userId },
    include: {
      members: { include: { faculty: true }, orderBy: { createdAt: "asc" } },
      project: {
        include: {
          track: true,
          submissions: {
            include: {
              files: { where: { isCurrent: true } },
              links: { where: { isCurrent: true } },
              results: true,
            },
          },
        },
      },
    },
  });
}

export function teamIsEligible(team: { eligibilityOverride: boolean; members: { verificationStatus: string }[] }) {
  return team.eligibilityOverride || (team.members.length > 0 && team.members.every((member) => member.verificationStatus === "VERIFIED"));
}
