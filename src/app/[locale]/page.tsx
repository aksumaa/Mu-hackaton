import { Bot, Building2, GraduationCap, HeartPulse, Landmark, Store, type LucideIcon } from "lucide-react";
import { enUS, ru as ruLocale, uz as uzLocale } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Countdown } from "@/components/chrome";
import { AnchorNav, CountUp, FillBar, Reveal, RubricTabs, Timeline } from "@/components/landing";
import { Link } from "@/i18n/navigation";
import { tr } from "@/lib/locale-text";
import { prisma } from "@/lib/prisma";
import { TASHKENT } from "@/lib/time";

const icons: Record<string, LucideIcon> = {
  "ai-automation": Bot,
  edtech: GraduationCap,
  healthtech: HeartPulse,
  fintech: Landmark,
  businesstech: Store,
  "smart-city": Building2,
};

const EXAMPLE = [
  ["ex1", 21, 25],
  ["ex2", 16, 20],
  ["ex3", 11, 15],
  ["ex4", 12, 15],
  ["ex5", 8, 10],
  ["ex6", 8, 10],
] as const;

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const [tracks, stages, criteria, jury] = await Promise.all([
    prisma.track.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }).catch(() => []),
    prisma.stage.findMany({ orderBy: { opensAt: "asc" } }).catch(() => []),
    prisma.criterion.findMany({ where: { stageKey: { in: ["STAGE1", "STAGE2"] } }, orderBy: [{ stageKey: "asc" }, { order: "asc" }] }).catch(() => []),
    prisma.judgeProfile.findMany({ where: { isPublished: true }, orderBy: [{ order: "asc" }, { displayName: "asc" }] }).catch(() => []),
  ]);
  const dateLocale = locale === "ru" ? ruLocale : locale === "en" ? enUS : uzLocale;
  const stamp = (date: Date) => formatInTimeZone(date, TASHKENT, "d MMM yyyy, HH:mm", { locale: dateLocale });
  const now = Date.now();
  const next = stages
    .flatMap((stage) => [stage.opensAt, stage.updateDeadlineAt, stage.deadlineAt])
    .filter((date) => date.getTime() > now)
    .sort((a, b) => a.getTime() - b.getTime())[0];
  const nextKind = next
    ? stages.find((stage) => stage.opensAt.getTime() === next.getTime())
      ? "opens"
      : stages.find((stage) => stage.updateDeadlineAt.getTime() === next.getTime())
        ? "updateAt"
        : "deadline"
    : null;
  const currentId = stages.find((stage) => stage.status === "OPEN")?.id
    ?? stages.find((stage) => stage.opensAt.getTime() <= now && now <= stage.deadlineAt.getTime())?.id;
  const anchors = ["what", "why", "goal", "timeline", "tracks", "judging", "jury", "join", "faq"] as const;
  const faqs = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;
  const rubric = (key: "STAGE1" | "STAGE2") => criteria
    .filter((row) => row.stageKey === key)
    .map((row) => ({ key: row.id, label: tr(locale, row.titleUz, row.titleRu, row.titleEn), max: row.maxPoints }));

  return (
    <div className="grid gap-16 sm:gap-24">
      <AnchorNav
        menu={t("land.menu")}
        close={t("common.close")}
        items={anchors.map((id) => ({ id, label: t(`land.nav.${id}`) }))}
      />

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
        {next && nextKind ? <Countdown iso={next.toISOString()} label={t(`hero.${nextKind}`)} /> : <p className="rounded-3xl border border-border bg-card p-5 text-sm text-muted">{t("hero.noDate")}</p>}
      </section>

      <section id="what">
        <Reveal>
          <h2 className="text-2xl font-semibold sm:text-3xl">{t("land.what.title")}</h2>
          <ul className="mt-4 grid max-w-2xl gap-2 text-muted">
            <li>{t("land.what.l1")}</li>
            <li>{t("land.what.l2")}</li>
            <li>{t("land.what.l3")}</li>
          </ul>
          <ol className="mt-6 grid gap-3 md:grid-cols-3">
            {(["idea", "mvp", "final"] as const).map((step, index) => (
              <li key={step} className="min-w-0 rounded-3xl border border-border bg-card p-5">
                <p className="text-sm font-semibold tracking-[0.14em]">0{index + 1}</p>
                <h3 className="mt-2 text-xl font-semibold">{t(`land.what.${step}`)}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{t(`land.what.${step}Body`)}</p>
              </li>
            ))}
          </ol>
        </Reveal>
      </section>

      <section id="why">
        <h2 className="text-2xl font-semibold sm:text-3xl">{t("land.why.title")}</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(["feedback", "portfolio", "pitch", "network", "path"] as const).map((key) => (
            <Reveal key={key}>
              <article className="h-full min-w-0 rounded-3xl border border-border bg-card p-5">
                <h3 className="text-lg font-semibold">{t(`land.why.${key}`)}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{t(`land.why.${key}Body`)}</p>
              </article>
            </Reveal>
          ))}
          <Reveal>
            <article className="h-full min-w-0 rounded-3xl border border-border bg-card p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em]">{t("land.why.example")}</p>
              <p className="mt-1 text-sm text-muted">{t("land.why.exampleNote")}</p>
              <p className="mt-3 text-2xl font-semibold"><CountUp value={76} /> / 100</p>
              <ul className="mt-4 grid gap-3">
                {EXAMPLE.map(([key, score, max]) => (
                  <li key={key}><FillBar label={t(`land.why.${key}`)} value={score} max={max} /></li>
                ))}
              </ul>
            </article>
          </Reveal>
        </div>
      </section>

      <section id="goal">
        <Reveal>
          <h2 className="text-2xl font-semibold sm:text-3xl">{t("land.goal.title")}</h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-muted">{t("land.goal.body")}</p>
        </Reveal>
      </section>

      <section id="timeline">
        <h2 className="text-2xl font-semibold sm:text-3xl">{t("land.timeline.title")}</h2>
        {stages.length === 0 ? <p className="mt-4 text-muted">{t("land.timeline.empty")}</p> : (
          <div className="mt-6">
            <Timeline
              currentLabel={t("land.timeline.current")}
              items={stages.map((stage) => ({
                id: stage.id,
                title: tr(locale, stage.titleUz, stage.titleRu, stage.titleEn),
                current: stage.id === currentId,
                rows: [
                  { label: t("land.timeline.opens"), value: stamp(stage.opensAt) },
                  { label: t("land.timeline.update"), value: stamp(stage.updateDeadlineAt) },
                  { label: t("land.timeline.deadline"), value: stamp(stage.deadlineAt) },
                ],
              }))}
            />
          </div>
        )}
      </section>

      <section id="tracks">
        <h2 className="text-2xl font-semibold sm:text-3xl">{t("land.tracks.title")}</h2>
        <p className="mt-3 max-w-2xl text-muted">{t("land.tracks.lede")}</p>
        {tracks.length === 0 ? <p className="mt-4 text-muted">{t("land.tracks.empty")}</p> : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tracks.map((track) => {
              const Icon = icons[track.slug] ?? Bot;
              return (
                <Reveal key={track.id}>
                  <article className="h-full min-w-0 rounded-3xl border border-border bg-card p-5">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-900 text-accent ring-1 ring-brand-600"><Icon aria-hidden size={20} /></span>
                    <h3 className="mt-4 break-words text-lg font-semibold">{tr(locale, track.nameUz, track.nameRu, track.nameEn)}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted">{tr(locale, track.descUz, track.descRu, track.descEn)}</p>
                  </article>
                </Reveal>
              );
            })}
          </div>
        )}
      </section>

      <section id="judging">
        <h2 className="text-2xl font-semibold sm:text-3xl">{t("land.judging.title")}</h2>
        <p className="mt-3 max-w-3xl text-muted">{t("land.judging.fair")}</p>
        <div className="mt-6 rounded-3xl border border-border bg-card p-5">
          {criteria.length === 0 ? <p className="text-muted">{t("land.judging.empty")}</p> : (
            <RubricTabs
              tabs={[
                { id: "STAGE1", label: t("land.judging.stage1"), rows: rubric("STAGE1") },
                { id: "STAGE2", label: t("land.judging.stage2"), rows: rubric("STAGE2") },
              ].filter((tab) => tab.rows.length > 0)}
            />
          )}
        </div>
      </section>

      <section id="jury">
        <h2 className="text-2xl font-semibold sm:text-3xl">{t("land.jury.title")}</h2>
        {jury.length === 0 ? <p className="mt-4 text-muted">{t("land.jury.empty")}</p> : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {jury.map((person) => (
              <li key={person.id} className="min-w-0 rounded-3xl border border-border bg-card p-5">
                {person.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={person.photoUrl} alt={person.displayName} className="h-16 w-16 rounded-full object-cover" />
                ) : (
                  <span aria-hidden className="grid h-16 w-16 place-items-center rounded-full bg-accent-soft text-lg font-semibold">{person.displayName.slice(0, 1)}</span>
                )}
                <h3 className="mt-4 break-words text-lg font-semibold">{person.displayName}</h3>
                <p className="text-sm">{person.title}</p>
                <p className="text-sm text-muted">{person.organization}</p>
                {person.bio ? <p className="mt-3 text-sm leading-6 text-muted">{person.bio}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="join">
        <h2 className="text-2xl font-semibold sm:text-3xl">{t("land.join.title")}</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-4">
          {(["1", "2", "3", "4"] as const).map((step) => (
            <li key={step} className="min-w-0 rounded-3xl border border-border bg-card p-5">
              <p className="text-sm font-semibold tracking-[0.14em]">0{step}</p>
              <h3 className="mt-2 font-semibold">{t(`land.join.s${step}`)}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{t(`land.join.s${step}b`)}</p>
            </li>
          ))}
        </ol>
        <Link href="/register" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-foreground">
          {t("land.join.cta")}
        </Link>
      </section>

      <section id="faq">
        <h2 className="text-2xl font-semibold sm:text-3xl">{t("land.faq.title")}</h2>
        <div className="mt-4 divide-y divide-border border-y border-border">
          {faqs.map((index) => (
            <details key={index} className="group py-4">
              <summary className="flex cursor-pointer items-start justify-between gap-4 font-semibold">
                <span className="min-w-0 break-words">{t(`land.faq.q${index}`)}</span>
                <span aria-hidden className="text-meter group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">{t(`land.faq.a${index}`)}</p>
            </details>
          ))}
        </div>
      </section>

      <section id="start" className="rounded-3xl border border-border bg-card p-5 sm:p-8">
        <h2 className="text-2xl font-semibold sm:text-4xl">{t("land.cta.title")}</h2>
        <p className="mt-3 max-w-xl text-muted">{t("land.cta.body")}</p>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-center">
          {next && nextKind ? <Countdown iso={next.toISOString()} label={t(`hero.${nextKind}`)} /> : <p className="text-sm text-muted">{t("hero.noDate")}</p>}
          <Link href="/register" className="inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-foreground lg:justify-self-end">
            {t("land.cta.button")}
          </Link>
        </div>
      </section>
    </div>
  );
}
