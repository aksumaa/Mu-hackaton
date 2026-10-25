import { getTranslations, setRequestLocale } from "next-intl/server";
import { LoginForm } from "@/components/auth-forms";
import { BrandLink } from "@/components/logo";
import { PageIntro } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { getSettings } from "@/lib/settings";

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const settings = await getSettings();
  return (
    <article className="mx-auto grid max-w-lg gap-6">
      <BrandLink />
      <PageIntro title={t("auth.loginTitle")} lede={t("auth.loginLede")} />
      <LoginForm locale={locale} />
      {settings.emailPasswordReset ? (
        <Link href="/forgot-password" className="text-sm font-semibold underline">{t("auth.forgotTitle")}</Link>
      ) : null}
    </article>
  );
}
