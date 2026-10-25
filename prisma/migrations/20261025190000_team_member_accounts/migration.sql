-- CreateEnum
CREATE TYPE "TeamRole" AS ENUM ('TEAM_LEADER', 'TEAM_MEMBER');

-- AlterTable
ALTER TABLE "TeamMember" ADD COLUMN "teamRole" "TeamRole" NOT NULL DEFAULT 'TEAM_MEMBER';
ALTER TABLE "TeamMember" ADD COLUMN "userId" TEXT;

UPDATE "TeamMember" AS member
SET "teamRole" = 'TEAM_LEADER', "userId" = team."leaderId"
FROM "Team" AS team
WHERE member."teamId" = team."id" AND member."isLeader" = true AND member."userId" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_userId_key" ON "TeamMember"("userId");

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
