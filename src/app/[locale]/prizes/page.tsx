import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageIntro } from "@/components/ui";

export default async function PrizesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  return (
    <article className="mx-auto max-w-3xl">
      <PageIntro title={t("pages.prizesTitle")} lede={t("pages.prizesLede")} />
      <div className="mt-8 grid gap-4 text-base leading-7">
        <p>{t("pages.p1")}</p>
        <p>{t("pages.p2")}</p>
        <p>{t("pages.p3")}</p>
      </div>
    </article>
  );
}
