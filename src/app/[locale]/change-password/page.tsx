import { getTranslations, setRequestLocale } from "next-intl/server";
import { ChangePasswordForm } from "@/components/auth-forms";
import { PageIntro } from "@/components/ui";
import { redirect } from "@/i18n/navigation";
import { currentUser } from "@/lib/session";

export default async function ChangePasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await currentUser();
  if (!user) redirect({ href: "/login", locale });
  const t = await getTranslations();
  return (
    <article className="grid gap-6">
      <PageIntro title={t("auth.changeTitle")} lede={t("auth.changeLede")} />
      <ChangePasswordForm locale={locale} />
    </article>
  );
}
