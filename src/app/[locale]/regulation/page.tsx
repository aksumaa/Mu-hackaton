import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageIntro } from "@/components/ui";
import { tr } from "@/lib/locale-text";
import { getContent } from "@/server/content";

export default async function RegulationPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const content = await getContent().catch(() => null);
  const paragraphs = content?.regulation
    ? [tr(locale, content.regulation.uz, content.regulation.ru, content.regulation.en)]
    : [1, 2, 3, 4, 5, 6, 7, 8].map((index) => t(`regulation.p${index}`));
  return (
    <article className="mx-auto max-w-3xl">
      <PageIntro title={t("pages.regulationTitle")} lede={t("pages.regulationLede")} />
      <div className="mt-8 grid gap-4 text-base leading-7">
        {paragraphs.map((paragraph) => (
          <p key={paragraph.slice(0, 24)} className="whitespace-pre-wrap break-words">{paragraph}</p>
        ))}
      </div>
    </article>
  );
}
