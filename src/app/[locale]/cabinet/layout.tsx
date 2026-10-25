import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { SectionNav } from "@/components/chrome";
import { requireRoles } from "@/lib/session";

export default async function CabinetLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRoles(locale, ["PARTICIPANT"]);
  const t = await getTranslations("cabinet");
  return (
    <div className="grid gap-6 pb-28 lg:pb-0">
      <SectionNav
        label={t("title")}
        items={[
          { href: "/cabinet", label: t("title") },
          { href: "/cabinet/team", label: t("team") },
          { href: "/cabinet/stage-1", label: t("stage1") },
          { href: "/cabinet/stage-2", label: t("stage2") },
          { href: "/cabinet/results", label: t("results") },
          { href: "/cabinet/notifications", label: t("notifications") },
        ]}
      />
      {children}
    </div>
  );
}
