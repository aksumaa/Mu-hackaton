import { getTranslations, setRequestLocale } from "next-intl/server";
import { RegisterForm } from "@/components/auth-forms";
import { BrandLink } from "@/components/logo";
import { Empty, PageIntro } from "@/components/ui";
import { tr } from "@/lib/locale-text";
import { prisma } from "@/lib/prisma";

export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const faculties = await prisma.faculty.findMany({ where: { isActive: true }, orderBy: { nameEn: "asc" } });
  return (
    <article className="mx-auto grid max-w-2xl gap-6">
      <BrandLink />
      <PageIntro title={t("auth.registerTitle")} lede={t("auth.registerLede")} />
      {faculties.length === 0 ? <Empty>{t("common.empty")}</Empty> : null}
      <RegisterForm locale={locale} faculties={faculties.map((faculty) => ({ id: faculty.id, name: tr(locale, faculty.nameUz, faculty.nameRu, faculty.nameEn) }))} />
    </article>
  );
}
