import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageIntro } from "@/components/ui";
import { CONTACTS, SOCIALS } from "@/config/university";
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
        {CONTACTS.address ? <p>{CONTACTS.address}</p> : <p>{t("pages.address")}</p>}
        {CONTACTS.phone ? <p className="mt-3"><a className="font-semibold underline" href={`tel:${CONTACTS.phone.replace(/[^\d+]/g, "")}`}>{CONTACTS.phone}</a></p> : null}
        {CONTACTS.email || email ? (
          <a className="mt-3 inline-flex break-all font-semibold underline" href={`mailto:${CONTACTS.email || email}`}>{CONTACTS.email || email}</a>
        ) : (
          <p className="mt-3 text-sm text-muted">{t("pages.contactMissing")}</p>
        )}
        <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold">
          {SOCIALS.website ? <a className="underline" href={SOCIALS.website}>{t("footer.website")}</a> : null}
          {SOCIALS.telegram ? <a className="underline" href={SOCIALS.telegram}>{t("footer.telegram")}</a> : null}
          {SOCIALS.instagram ? <a className="underline" href={SOCIALS.instagram}>{t("footer.instagram")}</a> : null}
        </div>
      </div>
    </article>
  );
}
