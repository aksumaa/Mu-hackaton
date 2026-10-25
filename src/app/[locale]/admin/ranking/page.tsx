import { getTranslations, setRequestLocale } from "next-intl/server";
import { ActionForm } from "@/components/action-form";
import { Badge, Button, Card, Empty, Field, TextArea, TextInput } from "@/components/ui";
import { planRanking } from "@/lib/ranking";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { computeRanking, publishResults, selectWinners } from "@/server/admin-actions";

export default async function RankingPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ stage?: string }> }) {
  const { locale } = await params;
  const { stage = "STAGE1" } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations();
  const key = stage === "STAGE2" ? "STAGE2" : "STAGE1";
  const settings = await getSettings();
  const submissions = await prisma.submission.findMany({
    where: { stageKey: key, status: { not: "DRAFT" } },
    include: {
      project: { include: { team: { include: { members: true } } } },
      assignments: { include: { evaluation: { include: { scores: true } } } },
      results: true,
    },
  });
  const rows = submissions.map((submission) => ({
    id: submission.id,
    title: submission.project.title || submission.id,
    eligible: submission.project.team.eligibilityOverride || submission.project.team.members.every((member) => member.verificationStatus === "VERIFIED"),
    totals: submission.assignments.filter((item) => item.evaluation?.finalizedAt && !item.conflictDeclared).map((item) => item.evaluation!.scores.reduce((sum, score) => sum + score.points, 0)),
    result: submission.results[0],
  }));
  const topN = key === "STAGE2" ? 12 : 20;
  const plan = planRanking({
    rows: rows.map((row) => ({ id: row.id, totals: row.totals })),
    threshold: settings.discrepancyThreshold,
    mode: settings.scoreAggregate,
    judgesExpected: settings.judgesPerSubmission,
    topN,
  });
  const ties = plan.filter((row) => row.tie);
  return (
    <div className="grid gap-4">
      <form method="get" className="flex gap-2">
        <select name="stage" defaultValue={key} aria-label={t("admin.stages")} className="min-h-11 rounded-xl border border-border bg-card px-3">
          <option value="STAGE1">{t("status.STAGE1")}</option>
          <option value="STAGE2">{t("status.STAGE2")}</option>
        </select>
        <Button type="submit">{t("common.search")}</Button>
      </form>
      <div className="flex flex-col gap-2 sm:flex-row">
        <ActionForm action={computeRanking} locale={locale} className="grid"><input type="hidden" name="key" value={key} /><Button type="submit">{t("admin.compute")}</Button></ActionForm>
        <ActionForm action={publishResults} locale={locale} className="grid gap-2">
          <input type="hidden" name="key" value={key} />
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirm" required className="mt-1 h-5 w-5" /><span>{t("admin.publishHint")}</span></label>
          <Button type="submit">{t("admin.publish")}</Button>
        </ActionForm>
      </div>
      {plan.length === 0 ? <Empty>{t("admin.noRows")}</Empty> : (
        <Card>
          <ActionForm action={selectWinners} locale={locale} className="grid gap-3">
            <input type="hidden" name="key" value={key} />
            <Field id="topN" label={t("admin.topN")}><TextInput id="topN" name="topN" type="number" min={1} max={100} defaultValue={topN} /></Field>
            {ties.length > 0 ? <p className="text-sm text-warning">{t("admin.tieWarning")} {t("admin.slots")}: {topN - plan.filter((row) => !row.tie && plan.find((item) => item.tie) && row.avg > (plan.find((item) => item.tie)?.avg ?? 0)).length}</p> : <p className="text-sm text-muted">{t("admin.selectHint")}</p>}
            <ul className="grid gap-2">
              {plan.map((row) => {
                const source = rows.find((item) => item.id === row.id);
                return (
                  <li key={row.id} className="grid gap-1 rounded-2xl border border-border p-3 text-sm sm:grid-cols-[auto_1fr_auto] sm:items-center">
                    {row.tie ? <input type="checkbox" name="tie" value={row.id} aria-label={source?.title} /> : <span />}
                    <span className="min-w-0 break-words">{row.rank}. {source?.title} {!source?.eligible ? <Badge tone="warn">{t("admin.ineligible")}</Badge> : null} {row.needsThirdJudge ? <Badge tone="bad">{t("admin.thirdJudge")}</Badge> : null} {row.short ? <Badge>{t("admin.lessThanTwo")}</Badge> : null}</span>
                    <span className="tabular-nums">{row.avg} / 100</span>
                  </li>
                );
              })}
            </ul>
            <Field id="tieNote" label={t("admin.tieNote")}><TextArea id="tieNote" name="tieNote" /></Field>
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirm" required className="mt-1 h-5 w-5" /><span>{t("common.confirmBox")}</span></label>
            <Button type="submit">{t("admin.selectTop")}</Button>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
