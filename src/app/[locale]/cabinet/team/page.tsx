import { getTranslations, setRequestLocale } from "next-intl/server";
import { Badge, Card, Empty } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { tr } from "@/lib/locale-text";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/session";
import { addMember, removeMember } from "@/server/participant-actions";
import { loadCabinet } from "@/server/cabinet";
import { TeamForm } from "@/components/team-form";

export default async function TeamPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRoles(locale, ["PARTICIPANT"]);
  const t = await getTranslations();
  const [team, faculties, stage] = await Promise.all([
    loadCabinet(user.id),
    prisma.faculty.findMany({ where: { isActive: true }, orderBy: { nameEn: "asc" } }),
    prisma.stage.findUnique({ where: { key: "STAGE1" } }),
  ]);
  if (!team) return <Empty>{t("cabinet.noTeam")}</Empty>;
  const open = Boolean(stage && stage.status === "OPEN" && Date.now() <= stage.deadlineAt.getTime());
  return (
    <div className="grid gap-4">
      <h1 className="text-3xl font-semibold">{t("cabinet.team")}</h1>
      <ul className="grid gap-3">
        {team.members.map((member) => (
          <li key={member.id}>
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words font-semibold">{member.fullName} {member.isLeader ? `· ${t("cabinet.leader")}` : ""}</p>
                  <p className="text-sm text-muted">{member.studentId} · {tr(locale, member.faculty.nameUz, member.faculty.nameRu, member.faculty.nameEn)} · {member.groupName}</p>
                  {member.rejectionNote ? <p className="mt-2 break-words text-sm text-danger">{member.rejectionNote}</p> : null}
                </div>
                <Badge tone={member.verificationStatus === "VERIFIED" ? "good" : member.verificationStatus === "REJECTED" ? "bad" : "warn"}>
                  {t(`status.${member.verificationStatus}`)}
                </Badge>
              </div>
              {member.verificationStatus === "REJECTED" ? <p className="mt-3 text-sm">{t("cabinet.rejected")}</p> : null}
              {member.verificationStatus === "PENDING" ? <p className="mt-3 text-sm text-muted">{t("cabinet.pending")}</p> : null}
              {!member.isLeader && open ? (
                <form action={removeMember} className="mt-3">
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="memberId" value={member.id} />
                  <button type="submit" className="min-h-11 rounded-full border border-border px-4 text-sm font-semibold">{t("common.remove")}</button>
                </form>
              ) : null}
            </Card>
          </li>
        ))}
      </ul>
      {open && team.members.length < 4 ? (
        <Card>
          <h2 className="font-semibold">{t("cabinet.addMember")}</h2>
          <TeamForm locale={locale} action={addMember} faculties={faculties.map((faculty) => ({ id: faculty.id, name: tr(locale, faculty.nameUz, faculty.nameRu, faculty.nameEn) }))} />
        </Card>
      ) : null}
      <Link href="/change-password" className="text-sm font-semibold underline">{t("cabinet.changePassword")}</Link>
    </div>
  );
}
