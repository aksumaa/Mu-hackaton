import { getTranslations, setRequestLocale } from "next-intl/server";
import { Countdown } from "@/components/chrome";
import { Badge, Card, Empty } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { lockReason } from "@/lib/deadlines";
import { formatTashkent } from "@/lib/time";
import { requireRoles } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { loadCabinet, teamIsEligible } from "@/server/cabinet";
import { asRecord } from "@/server/content";

export default async function CabinetHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRoles(locale, ["PARTICIPANT"]);
  const t = await getTranslations();
  const [team, stage] = await Promise.all([
    loadCabinet(user.id),
    prisma.stage.findUnique({ where: { key: "STAGE1" } }),
  ]);
  if (!team || !stage) return <Empty>{t("cabinet.noTeam")}</Empty>;
  const submission = team.project?.submissions.find((item) => item.stageKey === "STAGE1") ?? null;
  const payload = asRecord(submission?.payload);
  const checks = [
    ["title", Boolean(payload.title)],
    ["track", Boolean(team.project?.trackId)],
    ["problem", Boolean(payload.problem)],
    ["solution", Boolean(payload.solution)],
    ["consent", payload.consent === true],
  ] as const;
  const reason = lockReason(new Date(), stage, submission);
  const eligible = teamIsEligible(team);
  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-semibold">{t("cabinet.title")}</h1>
          <Badge tone={eligible ? "good" : "warn"}>{eligible ? t("cabinet.eligible") : t("cabinet.notEligible")}</Badge>
        </div>
        <p className="mt-3 text-muted">{t("cabinet.lede")}</p>
        <dl className="mt-4 grid gap-2 text-sm">
          <div><dt className="text-muted">{t("common.status")}</dt><dd className="font-semibold">{submission ? t(`status.${reason ?? submission.status}`) : t("status.DRAFT")}</dd></div>
          {submission?.firstSubmittedAt ? <div><dt className="text-muted">{t("cabinet.submittedAt")}</dt><dd className="tabular-nums">{formatTashkent(submission.firstSubmittedAt)}</dd></div> : null}
          <div><dt className="text-muted">{t("cabinet.updateLabel")}</dt><dd>{submission?.status === "SUBMITTED" && !submission.updateUsedAt && !reason ? t("cabinet.updateRemaining") : submission?.updateUsedAt ? t("cabinet.updateUsed") : t("common.none")}</dd></div>
        </dl>
        <Link href="/cabinet/stage-1" className="mt-5 inline-flex min-h-11 items-center font-semibold underline">{t("cabinet.stage1")}</Link>
      </Card>
      <Countdown iso={stage.deadlineAt.toISOString()} label={t("cabinet.countdown")} />
      <Card className="lg:col-span-2">
        <h2 className="font-semibold">{t("cabinet.checklist")}</h2>
        <ul className="mt-3 grid gap-2 text-sm">
          {checks.map(([key, done]) => (
            <li key={key} className="flex items-center justify-between gap-3">
              <span>{t(`cabinet.${key === "title" ? "titleField" : key}`)}</span>
              <Badge tone={done ? "good" : "warn"}>{done ? t("common.yes") : t("common.no")}</Badge>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
