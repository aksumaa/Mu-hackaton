import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageIntro } from "@/components/ui";
import { FINAL_CRITERIA, STAGE1_CRITERIA, STAGE2_CRITERIA, type CriterionSeed } from "@/lib/catalog";
import { tr } from "@/lib/locale-text";
import { prisma } from "@/lib/prisma";

export default async function CriteriaPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const loc = locale === "ru" || locale === "en" ? locale : "uz";
  const stored = await prisma.criterion.findMany({ orderBy: [{ stageKey: "asc" }, { order: "asc" }] });
  const groups = stored.length > 0
    ? (["STAGE1", "STAGE2", "FINAL"] as const).map((key) => ({
        key,
        rows: stored.filter((row) => row.stageKey === key).map((row) => ({
          key: row.key,
          max: row.maxPoints,
          title: tr(locale, row.titleUz, row.titleRu, row.titleEn),
          description: tr(locale, row.descUz, row.descRu, row.descEn),
        })),
      }))
    : [
        { key: "STAGE1" as const, rows: mapSeed(STAGE1_CRITERIA, loc) },
        { key: "STAGE2" as const, rows: mapSeed(STAGE2_CRITERIA, loc) },
        { key: "FINAL" as const, rows: mapSeed(FINAL_CRITERIA, loc) },
      ];
  return (
    <article>
      <PageIntro title={t("pages.criteriaTitle")} lede={t("pages.criteriaLede")} />
      <div className="mt-8 grid gap-6">
        {groups.map((group) => (
          <section key={group.key}>
            <h2 className="text-xl font-semibold">{t(`status.${group.key}`)}</h2>
            {group.key === "FINAL" ? <p className="mt-1 text-sm text-muted">{t("pages.finalNote")}</p> : null}
            <ol className="mt-3 grid gap-3">
              {group.rows.map((row) => (
                <li key={row.key} className="grid gap-1 rounded-2xl border border-border bg-card p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="break-words font-semibold">{row.title}</p>
                    <p className="text-sm text-muted">{row.description}</p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums">{row.max} / 100</p>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </article>
  );
}

function mapSeed(rows: CriterionSeed[], locale: "uz" | "ru" | "en") {
  return rows.map((row) => ({ key: row.key, max: row.maxPoints, title: row.title[locale], description: row.description[locale] }));
}
