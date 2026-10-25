import { getTranslations, setRequestLocale } from "next-intl/server";
import { ResetForm } from "@/components/auth-forms";
import { PageIntro } from "@/components/ui";

export default async function ResetPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { token } = await searchParams;
  const t = await getTranslations("auth");
  return (
    <article className="mx-auto grid max-w-lg gap-6">
      <PageIntro title={t("resetTitle")} lede={t("forgotLede")} />
      <ResetForm token={token ?? ""} />
    </article>
  );
}
