import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageIntro } from "@/components/ui";
import { tr } from "@/lib/locale-text";
import { getContent } from "@/server/content";

export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const content = await getContent().catch(() => null);
  const faq = content?.faq.length
    ? content.faq.map((item) => ({ q: tr(locale, item.qUz, item.qRu, item.qEn), a: tr(locale, item.aUz, item.aRu, item.aEn) }))
    : [1, 2, 3, 4, 5, 6].map((index) => ({ q: t(`faq.q${index}`), a: t(`faq.a${index}`) }));
  return (
    <article className="mx-auto max-w-3xl">
      <PageIntro title={t("pages.faqTitle")} lede={t("faqBlock.lede")} />
      <div className="mt-8 divide-y divide-border border-y border-border">
        {faq.map((item) => (
          <details key={item.q} className="group py-4">
            <summary className="flex cursor-pointer items-start justify-between gap-4 font-semibold">
              <span className="min-w-0 break-words">{item.q}</span>
              <span aria-hidden className="text-meter group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 text-sm leading-6 text-muted">{item.a}</p>
          </details>
        ))}
      </div>
    </article>
  );
}
