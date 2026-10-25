import type { StageKey } from "@prisma/client";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Badge, Card, Empty } from "@/components/ui";
import { toPublicFeedback } from "@/lib/files-access";
import { tr } from "@/lib/locale-text";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/session";
import { loadCabinet } from "@/server/cabinet";
import { asRecord } from "@/server/content";

export default async function ResultsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRoles(locale, ["PARTICIPANT"]);
  const t = await getTranslations();
  const team = await loadCabinet(user.id);
  if (!team?.project) return <Empty>{t("cabinet.resultsHidden")}</Empty>;
  const stages = await prisma.stage.findMany();
  const published = new Set(stages.filter((stage) => stage.status === "PUBLISHED").map((stage) => stage.key));
  const rows = team.project.submissions.filter((submission) => submission.results.length > 0 && published.has(submission.stageKey));
  if (rows.length === 0) return <Empty>{t("cabinet.resultsHidden")}</Empty>;
  return (
    <div className="grid gap-4">
      <h1 className="text-3xl font-semibold">{t("cabinet.results")}</h1>
      {rows.map((submission) => {
        const result = submission.results.find((item) => item.stageKey === submission.stageKey);
        if (!result) return null;
        const snapshot = asRecord(result.snapshot);
        const criteria = Array.isArray(snapshot.criteria) ? snapshot.criteria : [];
        const feedback = toPublicFeedback(Array.isArray(snapshot.feedback) ? snapshot.feedback as Parameters<typeof toPublicFeedback>[0] : []);
        return (
          <Card key={submission.id}>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold">{t(`status.${result.stageKey as StageKey}`)}</h2>
              <Badge tone={result.advanced ? "good" : "warn"}>{result.advanced ? t("cabinet.advanced") : t("cabinet.notAdvanced")}</Badge>
            </div>
            <p className="mt-3 text-3xl font-semibold tabular-nums">{result.avgTotal} / 100</p>
            <ul className="mt-4 grid gap-2">
              {criteria.map((item) => {
                const row = asRecord(item);
                return (
                  <li key={String(row.key)} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 break-words">{tr(locale, text(row.titleUz), text(row.titleRu), text(row.titleEn))}</span>
                    <span className="shrink-0 tabular-nums">{String(row.avg)} / {String(row.max)}</span>
                  </li>
                );
              })}
            </ul>
            {feedback.map((item, index) => (
              <div key={`${submission.id}-${index}`} className="mt-4 grid gap-2 text-sm">
                <h3 className="font-semibold">{t("cabinet.jury")} {index + 1}</h3>
                <p className="break-words"><span className="font-semibold">{t("cabinet.strengths")}: </span>{item.strengths.join(" · ")}</p>
                <p className="break-words"><span className="font-semibold">{t("cabinet.improvements")}: </span>{item.improvements.join(" · ")}</p>
                <p className="break-words"><span className="font-semibold">{t("cabinet.nextSteps")}: </span>{item.nextSteps}</p>
                <p className="break-words"><span className="font-semibold">{t("cabinet.comment")}: </span>{item.publicComment}</p>
              </div>
            ))}
          </Card>
        );
      })}
    </div>
  );
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}
