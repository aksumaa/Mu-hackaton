import { getTranslations, setRequestLocale } from "next-intl/server";
import { Badge, Empty, TableWrap } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { pickActiveStage } from "@/lib/deadlines";
import { tr } from "@/lib/locale-text";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { requireRoles } from "@/lib/session";
import { formatTashkent } from "@/lib/time";

export default async function JudgeHome({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; track?: string; status?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);
  const user = await requireRoles(locale, ["JUDGE"]);
  const t = await getTranslations();
  const settings = await getSettings();
  const stages = await prisma.stage.findMany();
  const stage = pickActiveStage(stages);
  const tracks = await prisma.track.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
  const submissions = stage
    ? await prisma.submission.findMany({
        where: {
          stageKey: stage.key,
          status: { not: "DRAFT" },
          ...(query.track || query.q
            ? {
                project: {
                  ...(query.track ? { trackId: query.track } : {}),
                  ...(query.q ? { title: { contains: query.q, mode: "insensitive" as const } } : {}),
                },
              }
            : {}),
        },
        include: {
          project: { include: { track: true, team: true } },
          assignments: { where: { judgeId: user.id }, include: { evaluation: { include: { scores: true } } } },
        },
        orderBy: { firstSubmittedAt: "desc" },
      })
    : [];
  const filtered = submissions.filter((submission) => {
    const assignment = submission.assignments[0];
    const status = assignment?.conflictDeclared ? "conflict" : assignment?.evaluation?.finalizedAt ? "DONE" : assignment?.evaluation ? "IN_PROGRESS" : "NOT_STARTED";
    return !query.status || query.status === status;
  });
  const finalized = submissions.filter((submission) => submission.assignments[0]?.evaluation?.finalizedAt).length;
  return (
    <div className="grid min-w-0 gap-4">
      <p className="text-sm text-muted">{t("judge.progress")}: {finalized} / {submissions.length}</p>
      {settings.blindReview ? <p className="text-sm">{t("judge.blind")}</p> : null}
      <div className="h-2 overflow-hidden rounded-full bg-accent-soft">
        <div className="h-2 bg-meter" style={{ width: submissions.length ? `${(finalized / submissions.length) * 100}%` : "0%" }} />
      </div>
      <form className="grid min-w-0 gap-3 sm:grid-cols-4" method="get">
        <input name="q" defaultValue={query.q ?? ""} placeholder={t("judge.searchPlaceholder")} aria-label={t("common.search")} className="min-h-11 w-full rounded-xl border border-border bg-card px-3 sm:col-span-2" />
        <select name="track" defaultValue={query.track ?? ""} aria-label={t("judge.filterTrack")} className="min-h-11 w-full rounded-xl border border-border bg-card px-3">
          <option value="">{t("judge.allTracks")}</option>
          {tracks.map((track) => <option key={track.id} value={track.id}>{tr(locale, track.nameUz, track.nameRu, track.nameEn)}</option>)}
        </select>
        <select name="status" defaultValue={query.status ?? ""} aria-label={t("judge.filterStatus")} className="min-h-11 w-full rounded-xl border border-border bg-card px-3">
          <option value="">{t("common.all")}</option>
          <option value="NOT_STARTED">{t("judge.notStarted")}</option>
          <option value="IN_PROGRESS">{t("judge.draftScore")}</option>
          <option value="DONE">{t("status.DONE")}</option>
        </select>
        <button type="submit" className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-foreground sm:col-span-4 sm:w-fit">{t("common.search")}</button>
      </form>
      {filtered.length === 0 ? <Empty>{t("judge.noSubmissions")}</Empty> : (
        <TableWrap>
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="sticky top-0 bg-card">
              <tr>
                <th className="p-3">{t("cabinet.titleField")}</th>
                <th className="p-3">{t("cabinet.track")}</th>
                <th className="p-3">{t("cabinet.submittedAt")}</th>
                <th className="p-3">{t("common.status")}</th>
                <th className="p-3">{t("judge.myScore")}</th>
                <th className="p-3">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((submission) => {
                const assignment = submission.assignments[0];
                const total = assignment?.evaluation?.scores.reduce((sum, score) => sum + score.points, 0);
                const status = assignment?.conflictDeclared ? "conflict" : assignment?.evaluation?.finalizedAt ? "DONE" : assignment?.evaluation ? "IN_PROGRESS" : "NOT_STARTED";
                return (
                  <tr key={submission.id} className="border-t border-border">
                    <td className="max-w-xs break-words p-3 font-semibold">{submission.project.title || submission.id}</td>
                    <td className="p-3">{tr(locale, submission.project.track.nameUz, submission.project.track.nameRu, submission.project.track.nameEn)}</td>
                    <td className="p-3 tabular-nums">{submission.firstSubmittedAt ? formatTashkent(submission.firstSubmittedAt) : t("common.none")}</td>
                    <td className="p-3"><Badge>{status === "conflict" ? t("admin.conflict") : t(`status.${status}`)}</Badge> {assignment ? <span className="ml-2">{t("judge.assignedToMe")}</span> : <span className="ml-2 text-muted">{t("judge.unassigned")}</span>}</td>
                    <td className="p-3 tabular-nums">{total == null ? "—" : `${total} / 100`}</td>
                    <td className="p-3"><Link href={`/judge/${submission.id}`} className="font-semibold underline">{t("judge.openProject")}</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      )}
    </div>
  );
}
