import { Bot, Building2, GraduationCap, HeartPulse, Landmark, Store, type LucideIcon } from "lucide-react";
import { enUS, ru as ruLocale, uz as uzLocale } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { connection } from "next/server";
import { Countdown } from "@/components/chrome";
import { AnchorNav, CountUp, HeroField, Journey, ProcessFlow, Reveal, Rise, RubricTabs, Timeline } from "@/components/landing";
import { Link } from "@/i18n/navigation";
import { homeFor, tr } from "@/lib/locale-text";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";
import { TASHKENT } from "@/lib/time";

const icons: Record<string, LucideIcon> = {
  "ai-automation": Bot,
  edtech: GraduationCap,
  healthtech: HeartPulse,
  fintech: Landmark,
  businesstech: Store,
  "smart-city": Building2,
};

export const dynamic = "force-dynamic";

const heading = "max-w-4xl font-display text-4xl font-semibold leading-[0.95] tracking-tight sm:text-6xl";
const button = "inline-flex min-h-12 items-center justify-center px-6 text-center text-sm font-semibold tracking-wide transition";

function HeroTitle({ text }: { text: string }) {
  const lines = text.split(/(?<=\.)\s+/).filter(Boolean);
  if (lines.length < 2) return text;
  return (
    <>
      {lines.map((line, index) => (
        <span
          key={line}
          className={index === 0 ? "block" : index === lines.length - 1 ? "mt-2 block text-brand-800 dark:text-brand-200 lg:ml-[8vw]" : "mt-2 block lg:ml-[4vw]"}
        >
          {line}
        </span>
      ))}
    </>
  );
}

function SectionTitle({ title, lede }: { title: string; lede?: string }) {
  return (
    <Reveal>
      <h2 className={heading}>{title}</h2>
      {lede ? <p className="mt-3 max-w-2xl text-base leading-7 text-muted">{lede}</p> : null}
    </Reveal>
  );
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await connection();
  setRequestLocale(locale);
  const t = await getTranslations();
  const user = await currentUser().catch(() => null);
  const accountHref = user ? homeFor(user.role) : "/register";
  const joinLabel = user && user.role !== "PARTICIPANT"
    ? t(user.role === "ADMIN" ? "nav.admin" : "nav.judge")
    : t("hero.cta");
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
  const anchors = ["what", "how", "tracks", "who", "why", "journey", "timeline", "judging", "faq"] as const;
  const faqs = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;
  const rubric = (key: "STAGE1" | "STAGE2") => criteria
    .filter((row) => row.stageKey === key)
    .map((row) => ({ key: row.id, label: tr(locale, row.titleUz, row.titleRu, row.titleEn), max: row.maxPoints }));
  const journey = (["1", "2", "3", "4", "5"] as const).map((step) => ({
    n: `0${step}`,
    mark: t(`land.journey.k${step}`),
    title: t(`land.journey.s${step}`),
    body: t(`land.journey.s${step}b`),
  }));
  const flow = (["1", "2", "3", "4"] as const).map((step) => ({
    n: `0${step}`,
    title: t(`land.what.f${step}`),
    body: t(`land.what.f${step}b`),
  }));
  const how = (["1", "2", "3", "4", "5"] as const).map((step) => ({
    n: `0${step}`,
    title: t(`land.how.h${step}`),
    body: t(`land.how.h${step}b`),
  }));
  const reasons = (["path", "network", "mentor", "portfolio", "pitch", "feedback"] as const).map((key) => ({
    title: t(`land.why.${key}`),
    body: t(`land.why.${key}Body`),
  }));
  const checks = (["1", "2", "3", "4", "5", "6", "7"] as const).map((step) => ({
    title: t(`land.check.c${step}`),
    body: t(`land.check.c${step}b`),
  }));
  const figures = [
    { value: 20, label: t("stats.spots"), hint: t("stats.spotsHint") },
    { value: 12, label: t("stats.finalists"), hint: t("stats.finalistsHint") },
    ...(tracks.length > 0 ? [{ value: tracks.length, label: t("stats.tracks"), hint: "" }] : []),
  ];

  return (
    <div className="grid min-w-0 gap-20 sm:gap-28">
      <section className="relative min-w-0 overflow-hidden">
        <div className="grid items-end gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:gap-6">
          <div className="min-w-0">
            <Rise>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-800 dark:text-brand-300">{t("hero.eyebrow")}</p>
            </Rise>
            <Rise delay={0.08}>
              <h1 className="mt-4 max-w-5xl font-display text-[clamp(2.7rem,8vw,6.6rem)] font-semibold leading-[0.88] tracking-tight">
                <HeroTitle text={t("hero.title")} />
              </h1>
            </Rise>
            <Rise delay={0.16}>
              <p className="mt-6 max-w-md text-base leading-7 text-muted sm:text-lg">{t("hero.subtitle")}</p>
            </Rise>
            <Rise delay={0.24}>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link href={accountHref} className={`${button} bg-foreground text-background hover:bg-brand-800`}>
                  {joinLabel}
                </Link>
                <a href="#tracks" className={`${button} border border-foreground hover:bg-foreground hover:text-background`}>
                  {t("hero.secondary")}
                </a>
                {user ? null : (
                  <Link href="/login" className={`${button} px-2 underline-offset-4 hover:underline`}>
                    {t("nav.login")}
                  </Link>
                )}
              </div>
            </Rise>
          </div>
          <HeroField steps={flow.map((step) => ({ n: step.n, title: step.title }))} />
        </div>
        <div className="mt-10 max-w-3xl">
          {next && nextKind ? <Countdown plain iso={next.toISOString()} label={t(`hero.${nextKind}`)} /> : <p className="border-t border-foreground pt-4 text-sm text-muted">{t("hero.noDate")}</p>}
        </div>
      </section>

      <AnchorNav
        menu={t("land.menu")}
        items={anchors.map((id) => ({ id, label: t(`land.nav.${id}`) }))}
      />

      <section id="what">
        <SectionTitle title={t("land.what.title")} lede={t("land.what.body")} />
        <ProcessFlow steps={flow} />
      </section>

      <section id="how">
        <SectionTitle title={t("land.how.title")} />
        <ol className="mt-8 border-t border-foreground">
          {how.map((step, index) => (
            <li key={step.n} className={index % 2 === 1 ? "md:ml-[14%]" : undefined}>
              <Reveal className="grid gap-2 border-b border-border py-6 md:grid-cols-[5rem_1fr_1.3fr] md:items-baseline">
                <p className="font-display text-4xl leading-none">{step.n}</p>
                <h3 className="font-display text-2xl font-semibold sm:text-3xl">{step.title}</h3>
                <p className="text-sm leading-6 text-muted">{step.body}</p>
              </Reveal>
            </li>
          ))}
        </ol>
        <div className="mt-10 grid grid-cols-3 gap-3 border-t border-foreground pt-4">
          {figures.map((item) => (
            <div key={item.label} className="min-w-0">
              <p className="font-display text-4xl font-semibold leading-none sm:text-6xl"><CountUp value={item.value} /></p>
              <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em]">{item.label}</p>
              {item.hint ? <p className="mt-1 text-sm leading-6 text-muted">{item.hint}</p> : null}
            </div>
          ))}
        </div>
      </section>

      <section id="tracks">
        <SectionTitle title={t("land.tracks.title")} lede={t("land.tracks.lede")} />
        {tracks.length === 0 ? <p className="mt-8 text-muted">{t("land.tracks.empty")}</p> : (
          <ol className="mt-8 border-t border-foreground">
            {tracks.map((track, index) => {
              const Icon = icons[track.slug] ?? Bot;
              return (
                <li key={track.id} className={index % 2 === 1 ? "md:pl-[12%]" : undefined}>
                  <Reveal className="grid gap-3 border-b border-border py-7 md:grid-cols-[5rem_auto_1fr_1.1fr] md:items-baseline md:gap-6">
                    <span className="font-display text-4xl leading-none text-brand-700">{String(index + 1).padStart(2, "0")}</span>
                    <Icon aria-hidden size={22} className="text-foreground" />
                    <h3 className="break-words font-display text-3xl font-semibold leading-tight sm:text-4xl">{tr(locale, track.nameUz, track.nameRu, track.nameEn)}</h3>
                    <p className="text-sm leading-6 text-muted md:text-base">{tr(locale, track.descUz, track.descRu, track.descEn)}</p>
                  </Reveal>
                </li>
              );
            })}
          </ol>
        )}
        <p className="mt-6">
          <Link href="/tracks" className="text-sm font-semibold underline-offset-4 hover:underline">{t("tracksBlock.more")}</Link>
        </p>
      </section>

      <section id="who" className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-end">
        <h2 className="font-display text-[clamp(2.6rem,6vw,5rem)] font-semibold leading-[0.9] tracking-tight">{t("land.who.title")}</h2>
        <div className="max-w-xl">
          <p className="text-lg leading-8">{t("land.who.body")}</p>
          <p className="mt-4 text-base leading-7 text-muted">{t("land.who.roles")}</p>
        </div>
      </section>

      <section id="why">
        <SectionTitle title={t("land.why.title")} />
        <ol className="mt-8 border-t border-foreground">
          {reasons.map((item, index) => (
            <li key={item.title} className="grid gap-2 border-b border-border py-6 md:grid-cols-[5rem_1fr_1.4fr] md:items-baseline">
              <p className="font-display text-3xl leading-none text-brand-700">{String(index + 1).padStart(2, "0")}</p>
              <h3 className="font-display text-2xl font-semibold">{item.title}</h3>
              <p className="text-sm leading-6 text-muted">{item.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="journey">
        <SectionTitle title={t("land.journey.title")} lede={t("land.journey.lede")} />
        <div className="mt-10">
          <Journey items={journey} />
        </div>
      </section>

      <section id="timeline">
        <SectionTitle title={t("land.timeline.title")} />
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
          {t("pages.timelineLede")}{" "}
          <Link href="/timeline" className="font-semibold text-foreground underline-offset-4 hover:underline">{t("nav.timeline")}</Link>
          {" · "}
          <Link href="/regulation" className="font-semibold text-foreground underline-offset-4 hover:underline">{t("nav.rules")}</Link>
        </p>
        {stages.length === 0 ? <p className="mt-8 text-muted">{t("land.timeline.empty")}</p> : (
          <div className="mt-10">
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

      <section id="judging" className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div>
          <h2 className={heading}>{t("land.judging.title")}</h2>
          <p className="mt-4 max-w-md text-base leading-7 text-muted">{t("land.judging.fair")}</p>
        </div>
        <div>
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

      <section id="prizes" className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <h2 className={heading}>{t("pages.prizesTitle")}</h2>
        <div className="max-w-xl">
          <p className="text-lg leading-8">{t("pages.prizesLede")}</p>
          <p className="mt-4 text-base leading-7 text-muted">{t("pages.p1")}</p>
          <p className="mt-3 text-base leading-7 text-muted">{t("pages.p2")}</p>
          <p className="mt-3 text-base leading-7 text-muted">{t("pages.p3")}</p>
          <Link href="/prizes" className="mt-6 inline-flex min-h-12 items-center text-sm font-semibold underline-offset-4 hover:underline">{t("nav.prizes")}</Link>
        </div>
      </section>

      <section id="jury">
        <SectionTitle title={t("land.jury.title")} />
        {jury.length === 0 ? (
          <p className="mt-8 max-w-xl font-display text-3xl leading-tight sm:text-5xl">{t("land.jury.empty")}</p>
        ) : (
          <ul className="mt-8 border-t border-foreground">
            {jury.map((person) => (
              <li key={person.id} className="grid gap-4 border-b border-border py-6 md:grid-cols-[5rem_1fr_1fr] md:items-baseline">
                {person.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={person.photoUrl} alt={person.displayName} className="h-14 w-14 object-cover" />
                ) : (
                  <span aria-hidden className="grid h-14 w-14 place-items-center bg-brand-900 font-display text-2xl text-brand-100">{person.displayName.slice(0, 1)}</span>
                )}
                <div>
                  <h3 className="break-words font-display text-3xl font-semibold">{person.displayName}</h3>
                  <p className="mt-1 text-sm">{person.title}</p>
                </div>
                <div>
                  <p className="text-sm text-muted">{person.organization}</p>
                  {person.bio ? <p className="mt-2 text-sm leading-6 text-muted">{person.bio}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="join">
        <SectionTitle title={t("land.join.title")} />
        <ol className="mt-8 border-t border-foreground">
          {(["1", "2", "3", "4"] as const).map((step) => (
            <li key={step} className="grid gap-2 border-b border-border py-6 md:grid-cols-[5rem_1fr_1.4fr] md:items-baseline">
              <p className="font-display text-4xl leading-none">0{step}</p>
              <h3 className="font-display text-2xl font-semibold">{t(`land.join.s${step}`)}</h3>
              <p className="text-sm leading-6 text-muted">{t(`land.join.s${step}b`)}</p>
            </li>
          ))}
        </ol>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link href={accountHref} className={`${button} bg-accent text-accent-foreground hover:brightness-95`}>
            {joinLabel}
          </Link>
          {user ? null : (
            <>
              <Link href="/login" className={`${button} border border-border bg-card hover:bg-accent-soft`}>
                {t("nav.login")}
              </Link>
              <Link href="/cabinet" className={`${button} border border-border bg-card hover:bg-accent-soft`}>
                {t("nav.cabinet")}
              </Link>
            </>
          )}
        </div>
      </section>

      <section id="check">
        <SectionTitle title={t("land.check.title")} lede={t("land.check.lede")} />
        <ol className="mt-8">
          {checks.map((item, index) => (
            <li key={item.title} className={index % 2 === 1 ? "md:ml-[18%]" : undefined}>
              <Reveal className="grid gap-2 border-t border-foreground py-6 md:grid-cols-[4.5rem_1fr] md:gap-6">
                <span className="font-display text-3xl leading-none text-brand-700">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="font-display text-2xl font-semibold sm:text-3xl">{item.title}</h3>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-muted">{item.body}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </section>

      <section id="faq">
        <SectionTitle title={t("land.faq.title")} />
        <div className="mt-6 grid gap-2">
          {faqs.map((index, order) => (
            <Reveal key={index} delay={order * 0.04}>
              <details className="group border-b border-foreground px-0">
                <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-4 py-3 font-semibold">
                  <span className="min-w-0 break-words">{t(`land.faq.q${index}`)}</span>
                  <span aria-hidden className="font-display text-2xl leading-none transition group-open:rotate-45">+</span>
                </summary>
                <p className="max-w-3xl pb-4 text-sm leading-6 text-muted">
                  {t(`land.faq.a${index}`)}
                  {index === "8" ? (
                    <>
                      {" "}
                      <Link href="/timeline" className="font-semibold text-foreground underline-offset-4 hover:underline">{t("nav.timeline")}</Link>
                      {" · "}
                      <Link href="/regulation" className="font-semibold text-foreground underline-offset-4 hover:underline">{t("nav.rules")}</Link>
                    </>
                  ) : null}
                </p>
              </details>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="start" className="relative -mx-4 overflow-hidden bg-brand-900 px-4 py-16 text-brand-50 sm:-mx-6 sm:px-6 sm:py-24">
        <p aria-hidden className="pointer-events-none absolute -right-4 top-6 font-display text-[8rem] leading-none text-brand-800 sm:text-[14rem]">05</p>
        <div className="relative max-w-4xl">
          <h2 className="font-display text-[clamp(3rem,8vw,7rem)] font-semibold leading-[0.86] tracking-tight text-brand-50">{t("land.cta.title")}</h2>
          <p className="mt-6 max-w-md text-lg text-brand-200">{t("land.cta.body")}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href={accountHref} className={`${button} bg-accent text-accent-foreground hover:brightness-95`}>
              {joinLabel}
            </Link>
            <a href="#tracks" className={`${button} border border-brand-200 text-brand-50 hover:bg-brand-800`}>
              {t("hero.secondary")}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
