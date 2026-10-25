import { getTranslations, setRequestLocale } from "next-intl/server";
import { Badge, Empty, TableWrap } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { tr } from "@/lib/locale-text";
import { prisma } from "@/lib/prisma";
import { formatTashkent } from "@/lib/time";

export default async function SubmissionsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ stage?: string }> }) {
  const { locale } = await params;
  const { stage = "STAGE1" } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations();
  const rows = await prisma.submission.findMany({
    where: { stageKey: stage === "STAGE2" ? "STAGE2" : "STAGE1" },
    include: { project: { include: { team: true, track: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return (
    <div className="grid gap-4">
      <form method="get" className="flex gap-2">
        <select name="stage" defaultValue={stage} aria-label={t("admin.stages")} className="min-h-11 rounded-xl border border-border bg-card px-3">
          <option value="STAGE1">{t("status.STAGE1")}</option>
          <option value="STAGE2">{t("status.STAGE2")}</option>
        </select>
        <button type="submit" className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-foreground">{t("common.search")}</button>
      </form>
      {rows.length === 0 ? <Empty>{t("admin.noRows")}</Empty> : (
        <TableWrap>
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead><tr><th className="p-2">{t("cabinet.titleField")}</th><th className="p-2">{t("cabinet.team")}</th><th className="p-2">{t("common.status")}</th><th className="p-2">{t("cabinet.submittedAt")}</th><th className="p-2">{t("common.actions")}</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="break-words p-2">{row.project.title || row.id}</td>
                  <td className="p-2">{row.project.team.name} · {tr(locale, row.project.track.nameUz, row.project.track.nameRu, row.project.track.nameEn)}</td>
                  <td className="p-2"><Badge>{t(`status.${row.status}`)}</Badge> {row.updateUsedAt ? t("cabinet.updateUsed") : ""}</td>
                  <td className="p-2 tabular-nums">{row.firstSubmittedAt ? formatTashkent(row.firstSubmittedAt) : t("common.none")}</td>
                  <td className="p-2"><Link className="font-semibold underline" href={`/admin/submissions/${row.id}`}>{t("common.view")}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </div>
  );
}
