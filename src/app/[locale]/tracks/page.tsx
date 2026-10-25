import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageIntro } from "@/components/ui";
import { TRACKS } from "@/lib/catalog";
import { tr } from "@/lib/locale-text";
import { prisma } from "@/lib/prisma";

export default async function TracksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const loc = locale === "ru" || locale === "en" ? locale : "uz";
  const tracks = await prisma.track.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
  const rows = tracks.length > 0
    ? tracks.map((track) => ({ slug: track.slug, name: tr(locale, track.nameUz, track.nameRu, track.nameEn), description: tr(locale, track.descUz, track.descRu, track.descEn) }))
    : TRACKS.map((track) => ({ slug: track.slug, name: track.name[loc], description: track.description[loc] }));
  return (
    <article>
      <PageIntro title={t("pages.tracksTitle")} lede={t("pages.tracksLede")} />
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {rows.map((track) => (
          <article key={track.slug} className="min-w-0 rounded-3xl border border-border bg-card p-5">
            <h2 className="break-words text-xl font-semibold">{track.name}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{track.description}</p>
          </article>
        ))}
      </div>
    </article>
  );
}
