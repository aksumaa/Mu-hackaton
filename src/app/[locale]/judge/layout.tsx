import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { requireRoles } from "@/lib/session";

export default async function JudgeLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRoles(locale, ["JUDGE"]);
  const t = await getTranslations("judge");
  return (
    <div className="grid min-w-0 gap-6">
      <h1 className="break-words text-3xl font-semibold">{t("title")}</h1>
      {children}
    </div>
  );
}
