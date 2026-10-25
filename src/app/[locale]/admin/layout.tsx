import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { SectionNav } from "@/components/chrome";
import { requireRoles } from "@/lib/session";

export default async function AdminLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRoles(locale, ["ADMIN"]);
  const t = await getTranslations("admin");
  const items = ["overview", "stages", "users", "roster", "submissions", "assignments", "ranking", "content", "jury", "settings", "audit"] as const;
  const hrefs: Record<(typeof items)[number], string> = {
    overview: "/admin",
    stages: "/admin/stages",
    users: "/admin/users",
    roster: "/admin/roster",
    submissions: "/admin/submissions",
    assignments: "/admin/assignments",
    ranking: "/admin/ranking",
    content: "/admin/content",
    jury: "/admin/jury",
    settings: "/admin/settings",
    audit: "/admin/audit",
  };
  return (
    <div className="grid gap-6">
      <h1 className="text-3xl font-semibold">{t("title")}</h1>
      <SectionNav label={t("title")} items={items.map((item) => ({ href: hrefs[item], label: t(item) }))} />
      {children}
    </div>
  );
}
