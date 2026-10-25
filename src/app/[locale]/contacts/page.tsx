import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageIntro } from "@/components/ui";
import { getSettings } from "@/lib/settings";

export default async function ContactsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const settings = await getSettings().catch(() => null);
  const email = settings?.contactEmail ?? "";
  return (
    <article className="mx-auto max-w-3xl">
      <PageIntro title={t("pages.contactTitle")} lede={t("pages.contactLede")} />
      <div className="mt-8 rounded-3xl border border-border bg-card p-5">
        <p>{t("pages.address")}</p>
        {email ? (
          <a className="mt-3 inline-flex break-all font-semibold underline" href={`mailto:${email}`}>{email}</a>
        ) : (
          <p className="mt-3 text-sm text-muted">{t("pages.contactMissing")}</p>
        )}
      </div>
    </article>
  );
}
