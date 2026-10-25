import { Bot, Building2, GraduationCap, HeartPulse, Landmark, Store, type LucideIcon } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Countdown } from "@/components/chrome";
import { FadeIn } from "@/components/fade-in";
import { Link } from "@/i18n/navigation";
import { STAGE1_CRITERIA, STAGE2_CRITERIA, TRACKS } from "@/lib/catalog";
import { tr } from "@/lib/locale-text";
import { prisma } from "@/lib/prisma";
import { getContent } from "@/server/content";

const icons: Record<string, LucideIcon> = {
  "ai-automation": Bot,
  edtech: GraduationCap,
  healthtech: HeartPulse,
  fintech: Landmark,
  businesstech: Store,
  "smart-city": Building2,
};

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const [tracks, stages, teams, announcements, content] = await Promise.all([
    prisma.track.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }).catch(() => []),
    prisma.stage.findMany({ orderBy: { opensAt: "asc" } }).catch(() => []),
    prisma.team.count().catch(() => 0),
    prisma.announcement.findMany({ where: { publishedAt: { not: null } }, orderBy: { publishedAt: "desc" }, take: 3 }).catch(() => []),
    getContent().catch(() => null),
  ]);
  const loc = locale === "ru" || locale === "en" ? locale : "uz";
  const shownTracks = tracks.length > 0 ? tracks.map((track) => ({
    slug: track.slug,
    name: tr(locale, track.nameUz, track.nameRu, track.nameEn),
    description: tr(locale, track.descUz, track.descRu, track.descEn),
  })) : TRACKS.map((track) => ({ slug: track.slug, name: track.name[loc], description: track.description[loc] }));
  const now = Date.now();
  const marks = stages.flatMap((stage) => [
    { at: stage.opensAt, kind: "opens" as const },
    { at: stage.updateDeadlineAt, kind: "update" as const },
    { at: stage.deadlineAt, kind: "deadline" as const },
  ]).filter((mark) => mark.at.getTime() > now).sort((a, b) => a.at.getTime() - b.at.getTime());
  const next = marks[0];
  const label = next ? t(`hero.${next.kind === "update" ? "updateAt" : next.kind === "opens" ? "opens" : "deadline"}`) : t("hero.noDate");
  const faq = content?.faq?.length ? content.faq.map((item) => ({ q: tr(locale, item.qUz, item.qRu, item.qEn), a: tr(locale, item.aUz, item.aRu, item.aEn) })) : [1, 2, 3, 4, 5, 6].map((index) => ({ q: t(`faq.q${index}`), a: t(`faq.a${index}`) }));

  return (
    <div className="grid gap-16 sm:gap-24">
      <FadeIn>
      <section className="grid items-end gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="min-w-0">
          <p className="flex items-start gap-3 text-xs font-semibold uppercase tracking-[0.08em] text-foreground sm:text-sm sm:tracking-[0.14em]">
            <span aria-hidden className="mt-[0.55em] h-px w-8 shrink-0 bg-meter" />
            <span className="min-w-0">{t("hero.eyebrow")}</span>
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-[1.02] tracking-tight sm:text-6xl">{t("hero.title")}</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted sm:text-lg">{t("hero.subtitle")}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/register" className="inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-5 text-center text-sm font-semibold text-accent-foreground">
              {t("hero.cta")}
            </Link>
            <Link href="/regulation" className="inline-flex min-h-12 items-center justify-center rounded-full border border-border bg-card px-5 text-center text-sm font-semibold">
              {t("hero.secondary")}
            </Link>
          </div>
        </div>
        {next ? <Countdown iso={next.at.toISOString()} label={label} /> : <p className="rounded-3xl border border-border bg-card p-5 text-sm text-muted">{t("hero.noDate")}</p>}
      </section>
      </FadeIn>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label={t("stats.teams")}>
        {[
          [String(teams), t("stats.teams"), ""],
          [String(shownTracks.length), t("stats.tracks"), ""],
          ["20", t("stats.spots"), t("stats.spotsHint")],
          ["12", t("stats.finalists"), t("stats.finalistsHint")],
        ].map(([value, caption, hint]) => (
          <div key={caption} className="min-w-0 rounded-3xl border border-border bg-card p-4">
            <p className="text-3xl font-semibold tabular-nums">{value}</p>
            <p className="mt-1 break-words text-sm font-semibold">{caption}</p>
            {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
          </div>
        ))}
      </section>

      <section>
        <h2 className="text-2xl font-semibold sm:text-3xl">{t("steps.title")}</h2>
        <p className="mt-3 max-w-2xl text-muted">{t("steps.lede")}</p>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {(["1", "2", "3"] as const).map((step) => (
            <li key={step} className="min-w-0 rounded-3xl border border-border bg-card p-5">
              <p className="flex items-center gap-3 text-sm font-semibold tracking-[0.14em] text-foreground">
                <span aria-hidden className="h-px w-6 bg-meter" />
                0{step}
              </p>
              <h3 className="mt-3 text-xl font-semibold">{t(`steps.s${step}t`)}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{t(`steps.s${step}b`)}</p>
              <p className="mt-4 text-sm font-semibold">{t(`steps.s${step}m`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold sm:text-3xl">{t("tracksBlock.title")}</h2>
            <p className="mt-3 max-w-2xl text-muted">{t("tracksBlock.lede")}</p>
          </div>
          <Link href="/tracks" className="text-sm font-semibold underline">{t("tracksBlock.more")}</Link>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shownTracks.map((track) => {
            const Icon = icons[track.slug] ?? Bot;
            return (
              <article key={track.slug} className="min-w-0 rounded-3xl border border-border bg-card p-5">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-900 text-accent ring-1 ring-brand-600"><Icon aria-hidden size={20} /></span>
                <h3 className="mt-4 break-words text-lg font-semibold">{track.name}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{track.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold sm:text-3xl">{t("criteriaBlock.title")}</h2>
        <p className="mt-3 max-w-2xl text-muted">{t("criteriaBlock.lede")}</p>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {[{ title: t("criteriaBlock.stage1"), rows: STAGE1_CRITERIA }, { title: t("criteriaBlock.stage2"), rows: STAGE2_CRITERIA }].map((group) => (
            <div key={group.title} className="min-w-0 rounded-3xl border border-border bg-card p-5">
              <h3 className="font-semibold">{group.title}</h3>
              <ul className="mt-4 grid gap-3">
                {group.rows.map((row) => (
                  <li key={row.key}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 break-words">{row.title[loc]}</span>
                      <span className="shrink-0 tabular-nums">{row.maxPoints}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-accent-soft">
                      <div className="bar h-2 rounded-full bg-meter" style={{ width: `${(row.maxPoints / 25) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <Link href="/criteria" className="mt-4 inline-flex text-sm font-semibold underline">{t("criteriaBlock.more")}</Link>
      </section>

      {announcements.length > 0 ? (
        <section>
          <h2 className="text-2xl font-semibold">{t("announce.title")}</h2>
          <div className="mt-4 grid gap-3">
            {announcements.map((item) => (
              <article key={item.id} className="rounded-3xl border border-border bg-card p-5">
                <h3 className="break-words font-semibold">{tr(locale, item.titleUz, item.titleRu, item.titleEn)}</h3>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted">{tr(locale, item.bodyUz, item.bodyRu, item.bodyEn)}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="text-2xl font-semibold sm:text-3xl">{t("faqBlock.title")}</h2>
        <p className="mt-3 text-muted">{t("faqBlock.lede")}</p>
        <div className="mt-4 divide-y divide-border border-y border-border">
          {faq.map((item) => (
            <details key={item.q} className="group py-4">
              <summary className="flex cursor-pointer items-start justify-between gap-4 font-semibold">
                <span className="min-w-0 break-words">{item.q}</span>
                <span aria-hidden className="text-meter group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
