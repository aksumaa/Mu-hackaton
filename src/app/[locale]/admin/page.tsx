import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { formatTashkent } from "@/lib/time";

export default async function AdminHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const settings = await getSettings();
  const soon = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const [teams, drafts, submitted, pending, stages, gaps, unassigned] = await Promise.all([
    prisma.team.count(),
    prisma.submission.count({ where: { status: "DRAFT" } }),
    prisma.submission.count({ where: { status: { in: ["SUBMITTED", "UPDATED", "LOCKED"] } } }),
    prisma.teamMember.count({ where: { verificationStatus: "PENDING" } }),
    prisma.stage.findMany({ where: { deadlineAt: { lte: soon, gte: new Date() }, status: { in: ["OPEN", "EVALUATING"] } } }),
    prisma.stageResult.count({ where: { needsThirdJudge: true } }),
    prisma.submission.count({
      where: {
        status: { not: "DRAFT" },
        assignments: { none: { conflictDeclared: false } },
      },
    }),
  ]);
  const cards = [
    [t("admin.registered"), teams, "/admin/users"],
    [t("admin.drafts"), drafts, "/admin/submissions"],
    [t("admin.submittedCount"), submitted, "/admin/submissions"],
    [t("admin.pendingVerifications"), pending, "/admin/users"],
    [t("admin.discrepancies"), gaps, "/admin/ranking"],
    [t("admin.unassigned"), unassigned, "/admin/assignments"],
  ] as const;
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([label, value, href]) => (
          <Link key={label} href={href} className="rounded-3xl border border-border bg-card p-5">
            <p className="text-3xl font-semibold tabular-nums">{value}</p>
            <p className="mt-1 break-words text-sm font-semibold">{label}</p>
          </Link>
        ))}
      </div>
      <Card>
        <h2 className="font-semibold">{t("admin.deadlinesSoon")}</h2>
        {stages.length === 0 ? <p className="mt-2 text-sm text-muted">{t("common.none")}</p> : (
          <ul className="mt-3 grid gap-2 text-sm">
            {stages.map((stage) => <li key={stage.id}>{stage.key} · {formatTashkent(stage.deadlineAt)} · {settings.judgesPerSubmission}</li>)}
          </ul>
        )}
      </Card>
      {/* Downloads are file responses, so they stay full page navigations. */}
      {/* eslint-disable @next/next/no-html-link-for-pages */}
      <div className="flex flex-wrap gap-3 text-sm font-semibold">
        <a className="underline" href="/api/admin/export?type=scores">{t("admin.exportScores")}</a>
        <a className="underline" href="/api/admin/export?type=ranking">{t("admin.exportRanking")}</a>
        <a className="underline" href="/api/admin/export?type=people">{t("admin.exportPeople")}</a>
      </div>
      {/* eslint-enable @next/next/no-html-link-for-pages */}
    </div>
  );
}
