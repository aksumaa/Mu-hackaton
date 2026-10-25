import { getTranslations, setRequestLocale } from "next-intl/server";
import { Empty, TableWrap } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { formatTashkent } from "@/lib/time";

export default async function AuditPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const rows = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { actor: true } });
  if (rows.length === 0) return <Empty>{t("admin.auditEmpty")}</Empty>;
  return (
    <TableWrap>
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead><tr><th className="p-2">{t("cabinet.submittedAt")}</th><th className="p-2">{t("admin.fullName")}</th><th className="p-2">{t("common.actions")}</th><th className="p-2">{t("admin.submission")}</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-border">
              <td className="p-2 tabular-nums">{formatTashkent(row.createdAt)}</td>
              <td className="p-2">{row.actor?.fullName ?? t("common.none")}</td>
              <td className="p-2">{row.action}</td>
              <td className="break-all p-2">{row.entity} {row.entityId ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}
