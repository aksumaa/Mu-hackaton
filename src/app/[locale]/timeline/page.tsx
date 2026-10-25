import { getTranslations, setRequestLocale } from "next-intl/server";
import { Badge, PageIntro } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { formatTashkent } from "@/lib/time";
import { tr } from "@/lib/locale-text";

export default async function TimelinePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const stages = await prisma.stage.findMany({ orderBy: { opensAt: "asc" } });
  return (
    <article>
      <PageIntro title={t("pages.timelineTitle")} lede={t("pages.timelineLede")} />
      <ol className="mt-8 grid gap-4">
        {stages.map((stage) => (
          <li key={stage.id} className="min-w-0 rounded-3xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold">{tr(locale, stage.titleUz, stage.titleRu, stage.titleEn)}</h2>
              <Badge>{t(`status.${stage.status}`)}</Badge>
            </div>
            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
              <div><dt className="text-muted">{t("admin.openStage")}</dt><dd className="font-semibold tabular-nums">{formatTashkent(stage.opensAt)}</dd></div>
              <div><dt className="text-muted">{t("admin.updateDeadline")}</dt><dd className="font-semibold tabular-nums">{formatTashkent(stage.updateDeadlineAt)}</dd></div>
              <div><dt className="text-muted">{t("admin.deadline")}</dt><dd className="font-semibold tabular-nums">{formatTashkent(stage.deadlineAt)}</dd></div>
            </dl>
          </li>
        ))}
      </ol>
    </article>
  );
}
