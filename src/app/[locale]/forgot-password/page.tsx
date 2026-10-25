import { getTranslations, setRequestLocale } from "next-intl/server";
import { ForgotForm } from "@/components/auth-forms";
import { PageIntro } from "@/components/ui";
import { redirect } from "@/i18n/navigation";
import { getSettings } from "@/lib/settings";

export default async function ForgotPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const settings = await getSettings();
  if (!settings.emailPasswordReset) redirect({ href: "/login", locale });
  const t = await getTranslations("auth");
  return (
    <article className="mx-auto grid max-w-lg gap-6">
      <PageIntro title={t("forgotTitle")} lede={t("forgotLede")} />
      <ForgotForm />
    </article>
  );
}
