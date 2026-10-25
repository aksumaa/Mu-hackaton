import { PrismaClient, type StageKey } from "@prisma/client";
import argon2 from "argon2";
import { FACULTIES } from "../src/config/university";
import { FINAL_CRITERIA, STAGE1_CRITERIA, STAGE2_CRITERIA, TRACKS, type CriterionSeed } from "../src/lib/catalog";
import { defaultSettings } from "../src/lib/settings";
import { tashkentInputToUtc } from "../src/lib/time";

const prisma = new PrismaClient();

async function main() {
  const faculties = await syncFaculties();
  const it = faculties.find((faculty) => faculty.nameEn === "School of IT") ?? faculties[0];
  if (!it) throw new Error("No faculty is available to seed");
  for (const track of TRACKS) {
    await prisma.track.upsert({
      where: { slug: track.slug },
      create: {
        slug: track.slug,
        sortOrder: track.order,
        nameUz: track.name.uz,
        nameRu: track.name.ru,
        nameEn: track.name.en,
        descUz: track.description.uz,
        descRu: track.description.ru,
        descEn: track.description.en,
      },
      update: {},
    });
  }
  const stages: { key: StageKey; title: { uz: string; ru: string; en: string }; opens: string; update: string; deadline: string; status: "OPEN" | "DRAFT" }[] = [
    { key: "STAGE1", title: { uz: "1-bosqich", ru: "Этап 1", en: "Stage 1" }, opens: "2026-10-20T09:00", update: "2026-11-01T18:00", deadline: "2026-11-02T23:59", status: "OPEN" },
    { key: "STAGE2", title: { uz: "2-bosqich", ru: "Этап 2", en: "Stage 2" }, opens: "2026-11-05T09:00", update: "2026-11-18T18:00", deadline: "2026-11-20T23:59", status: "OPEN" },
    { key: "FINAL", title: { uz: "Final", ru: "Финал", en: "Final" }, opens: "2026-11-25T09:00", update: "2026-11-27T18:00", deadline: "2026-11-28T18:00", status: "DRAFT" },
  ];
  for (const stage of stages) {
    await prisma.stage.upsert({
      where: { key: stage.key },
      create: {
        key: stage.key,
        titleUz: stage.title.uz,
        titleRu: stage.title.ru,
        titleEn: stage.title.en,
        opensAt: tashkentInputToUtc(stage.opens),
        updateDeadlineAt: tashkentInputToUtc(stage.update),
        deadlineAt: tashkentInputToUtc(stage.deadline),
        status: stage.status,
      },
      update: {
        opensAt: tashkentInputToUtc(stage.opens),
        updateDeadlineAt: tashkentInputToUtc(stage.update),
        deadlineAt: tashkentInputToUtc(stage.deadline),
        status: stage.status,
        revealScoresToJudges: false,
      },
    });
  }
  await seedCriteria("STAGE1", STAGE1_CRITERIA);
  await seedCriteria("STAGE2", STAGE2_CRITERIA);
  await seedCriteria("FINAL", FINAL_CRITERIA);
  await prisma.appSetting.upsert({
    where: { key: "platform" },
    create: { key: "platform", value: defaultSettings },
    update: {},
  });

  const adminHash = await argon2.hash("Admin-pass-1");
  const judgeHash = await argon2.hash("Judge-pass-1");
  const teamHash = await argon2.hash("Team-pass-1");
  await ensureUser({ studentId: "MU-ADMIN", fullName: "Platform Admin", role: "ADMIN", passwordHash: adminHash, facultyId: it.id });
  const judges = [];
  for (const [index, name] of ["Judge One", "Judge Two", "Judge Three"].entries()) {
    judges.push(await ensureUser({ studentId: `MU-JUDGE-${index + 1}`, fullName: name, role: "JUDGE", passwordHash: judgeHash, facultyId: it.id }));
  }
  const leader = await ensureUser({ studentId: "MU-24001", fullName: "Demo Leader", role: "PARTICIPANT", passwordHash: teamHash, facultyId: it.id, course: 2, groupName: "IT-23-01" });
  const other = await ensureUser({ studentId: "MU-24002", fullName: "Second Leader", role: "PARTICIPANT", passwordHash: teamHash, facultyId: it.id, course: 3, groupName: "IT-23-02" });
  for (const person of [
    { studentId: "MU-24001", fullName: "Demo Leader", groupName: "IT-23-01" },
    { studentId: "MU-24002", fullName: "Second Leader", groupName: "IT-23-02" },
  ]) {
    await prisma.rosterEntry.upsert({
      where: { studentId: person.studentId },
      create: { ...person, facultyId: it.id },
      update: {},
    });
  }
  const track = await prisma.track.findFirstOrThrow({ where: { slug: "edtech" } });
  const leaderTeam = await ensureTeam(leader.id, "Demo Leader", it.id, "IT-23-01", 2);
  const member = await ensureUser({ studentId: "MU-24011", fullName: "Demo Member", role: "PARTICIPANT", passwordHash: teamHash, facultyId: it.id, course: 2, groupName: "IT-23-01" });
  await ensureMembership(leaderTeam.id, member.id, "Demo Member", "MU-24011", it.id, "IT-23-01", 2);
  await prisma.submission.deleteMany({ where: { project: { teamId: leaderTeam.id } } });
  const submittedTeam = await ensureTeam(other.id, "Second Leader", it.id, "IT-23-02", 3);
  const project = await prisma.project.upsert({
    where: { teamId: submittedTeam.id },
    create: { teamId: submittedTeam.id, trackId: track.id, title: "Campus queue" },
    update: { title: "Campus queue", trackId: track.id },
  });
  await prisma.submission.upsert({
    where: { projectId_stageKey: { projectId: project.id, stageKey: "STAGE1" } },
    create: {
      projectId: project.id,
      stageKey: "STAGE1",
      status: "SUBMITTED",
      firstSubmittedAt: new Date("2026-10-25T08:00:00.000Z"),
      payload: {
        title: "Campus queue",
        shortDescription: "A quieter way for students to reach university services without standing in three lines.",
        problem: "Students lose hours moving between offices because nobody can see the real queue.",
        audience: "First-year students and the registrar staff who answer the same question all morning.",
        solution: "One queue number, a status page, and a desk view for the registrar.",
        differentiation: "It is built around the university's actual windows, not a generic ticket bot.",
        validation: "Twelve students described the same Tuesday morning wait.",
        teamRoles: "Second Leader writes the product and tests it with the registrar.",
        consent: true,
      },
    },
    update: {},
  });
  const submission = await prisma.submission.findUniqueOrThrow({ where: { projectId_stageKey: { projectId: project.id, stageKey: "STAGE1" } } });
  if (judges[0] && judges[1]) {
    for (const judge of [judges[0], judges[1]]) {
      await prisma.judgeAssignment.upsert({
        where: { judgeId_submissionId: { judgeId: judge.id, submissionId: submission.id } },
        create: { judgeId: judge.id, submissionId: submission.id },
        update: {},
      });
    }
  }
}

async function seedCriteria(stageKey: StageKey, rows: CriterionSeed[]) {
  for (const row of rows) {
    await prisma.criterion.upsert({
      where: { stageKey_key: { stageKey, key: row.key } },
      create: {
        stageKey,
        order: row.order,
        key: row.key,
        maxPoints: row.maxPoints,
        titleUz: row.title.uz,
        titleRu: row.title.ru,
        titleEn: row.title.en,
        descUz: row.description.uz,
        descRu: row.description.ru,
        descEn: row.description.en,
      },
      update: {},
    });
  }
}

async function ensureUser(input: {
  studentId: string;
  fullName: string;
  role: "ADMIN" | "JUDGE" | "PARTICIPANT";
  passwordHash: string;
  facultyId: string;
  course?: number;
  groupName?: string;
}) {
  const existing = await prisma.user.findUnique({ where: { studentId: input.studentId } });
  if (existing) return existing;
  return prisma.user.create({ data: { ...input, locale: "uz" } });
}

async function syncFaculties() {
  const rows = [];
  for (const faculty of FACULTIES) {
    if (!faculty.en) continue;
    // uz/ru stay null in config until millatumidi.uz publishes them. The columns are required, so the verified English name is stored.
    const nameUz = faculty.uz ?? faculty.en;
    const nameRu = faculty.ru ?? faculty.en;
    const existing = await prisma.faculty.findFirst({ where: { nameEn: faculty.en } });
    rows.push(existing
      ? await prisma.faculty.update({ where: { id: existing.id }, data: { nameUz, nameRu, nameEn: faculty.en, isActive: true } })
      : await prisma.faculty.create({ data: { nameUz, nameRu, nameEn: faculty.en, isActive: true } }));
  }
  const names = FACULTIES.flatMap((faculty) => faculty.en ? [faculty.en] : []);
  if (names.length) await prisma.faculty.updateMany({ where: { nameEn: { notIn: names } }, data: { isActive: false } });
  return rows;
}

async function ensureTeam(leaderId: string, fullName: string, facultyId: string, groupName: string, course: number) {
  const existing = await prisma.team.findUnique({ where: { leaderId }, include: { members: true } });
  if (existing) {
    const leaderMember = existing.members.find((member) => member.isLeader);
    if (leaderMember && !leaderMember.userId) {
      await prisma.teamMember.update({ where: { id: leaderMember.id }, data: { userId: leaderId, teamRole: "TEAM_LEADER" } });
    }
    return existing;
  }
  const leader = await prisma.user.findUniqueOrThrow({ where: { id: leaderId } });
  return prisma.team.create({
    data: {
      leaderId,
      name: fullName,
      members: {
        create: {
          fullName,
          studentId: leader.studentId,
          userId: leaderId,
          facultyId,
          course,
          groupName,
          verificationStatus: "VERIFIED",
          isLeader: true,
          teamRole: "TEAM_LEADER",
        },
      },
    },
  });
}

async function ensureMembership(teamId: string, userId: string, fullName: string, studentId: string, facultyId: string, groupName: string, course: number) {
  const existing = await prisma.teamMember.findUnique({ where: { studentId } });
  if (existing) {
    if (!existing.userId) await prisma.teamMember.update({ where: { id: existing.id }, data: { userId, teamRole: "TEAM_MEMBER" } });
    return;
  }
  await prisma.teamMember.create({
    data: {
      teamId,
      userId,
      fullName,
      studentId,
      facultyId,
      course,
      groupName,
      verificationStatus: "VERIFIED",
      isLeader: false,
      teamRole: "TEAM_MEMBER",
    },
  });
}

main().then(() => prisma.$disconnect()).catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
