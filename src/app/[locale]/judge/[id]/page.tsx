import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ScorePanel } from "@/components/score-panel";
import { Link } from "@/i18n/navigation";
import { canScoreSubmission } from "@/lib/guards";
import { visibleTeam } from "@/lib/files-access";
import { tr } from "@/lib/locale-text";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { requireRoles } from "@/lib/session";
import { signLocalFile } from "@/lib/storage";
import { safeHttpUrl } from "@/lib/utils";
import { youtubeEmbed } from "@/lib/youtube";
import { asRecord, asString } from "@/server/content";

export default async function JudgeProjectPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireRoles(locale, ["JUDGE"]);
  const t = await getTranslations();
  const submission = await prisma.submission.findUnique({
    where: { id },
    include: {
      project: { include: { track: true, team: { include: { members: true } } } },
      files: { where: { isCurrent: true } },
      links: { where: { isCurrent: true } },
      assignments: { where: { judgeId: user.id }, include: { evaluation: { include: { scores: true } } } },
    },
  });
  if (!submission || submission.status === "DRAFT") notFound();
  const stage = await prisma.stage.findUnique({ where: { key: submission.stageKey }, include: { criteria: { orderBy: { order: "asc" } } } });
  if (!stage) notFound();
  const settings = await getSettings();
  const assignment = submission.assignments[0] ?? null;
  const evaluation = assignment?.evaluation ?? null;
  const canScore = canScoreSubmission({
    actor: { id: user.id, role: user.role, isActive: user.isActive },
    assigned: Boolean(assignment),
    conflictDeclared: Boolean(assignment?.conflictDeclared),
    judgesCanScoreAny: settings.judgesCanScoreAny,
    stageStatus: stage.status,
  });
  const team = visibleTeam(settings.blindReview, {
    name: submission.project.team.name,
    members: submission.project.team.members.map((member) => ({ fullName: member.fullName })),
  });
  const payload = asRecord(submission.payload);
  const scores = Object.fromEntries((evaluation?.scores ?? []).map((score) => [score.criterionId, score.points]));
  const revealed = stage.status === "PUBLISHED" || stage.revealScoresToJudges;
  const others = revealed
    ? await prisma.evaluation.findMany({
        where: { finalizedAt: { not: null }, assignment: { submissionId: submission.id, judgeId: { not: user.id } } },
        select: { id: true, scores: { select: { points: true } }, publicComment: true },
      })
    : [];
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <article className="grid min-w-0 gap-4 pb-24 lg:pb-0">
        <p><Link href="/judge" className="text-sm font-semibold underline">{t("common.back")}</Link></p>
        <h2 className="break-words text-3xl font-semibold">{submission.project.title || submission.id}</h2>
        <p className="text-sm text-muted">{tr(locale, submission.project.track.nameUz, submission.project.track.nameRu, submission.project.track.nameEn)}</p>
        {settings.blindReview ? <p className="text-sm">{t("judge.teamHidden")}</p> : (
          <p className="text-sm">{team.name} · {team.members.map((member) => member.fullName).join(", ")}</p>
        )}
        {Object.entries(payload).filter(([key]) => key !== "checklist" && key !== "trackId").map(([key, value]) => (
          <section key={key}>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{key}</h3>
            <p className="mt-1 whitespace-pre-wrap break-words">{typeof value === "string" ? value : typeof value === "boolean" ? (value ? t("common.yes") : t("common.no")) : ""}</p>
          </section>
        ))}
        <section className="grid gap-2">
          <h3 className="font-semibold">{t("judge.links")}</h3>
          {submission.links.map((link) => {
            const href = safeHttpUrl(link.url);
            const embed = link.kind === "VIDEO" && href ? youtubeEmbed(href) : null;
            return href ? (
              <div key={link.id}>
                <a href={href} className="break-all font-semibold underline" rel="noreferrer" target="_blank">{link.kind}</a>
                {embed ? <iframe className="mt-3 aspect-video w-full rounded-2xl border border-border" src={embed} title={link.kind} allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen /> : null}
              </div>
            ) : null;
          })}
          {submission.files.map((file) => (
            <div key={file.id}>
              <a className="break-all underline" href={signLocalFile(file.id, 900)}>{file.originalName}</a>
              {file.mime === "application/pdf" ? <iframe className="mt-3 h-96 w-full rounded-2xl border border-border" src={signLocalFile(file.id, 900)} title={file.originalName} /> : null}
              {file.mime === "video/mp4" ? <video className="mt-3 w-full rounded-2xl" controls src={signLocalFile(file.id, 900)} /> : null}
            </div>
          ))}
        </section>
        {asString(payload.accessInstructions) ? <p className="whitespace-pre-wrap break-words text-sm">{asString(payload.accessInstructions)}</p> : null}
        {revealed ? (
          <section className="grid gap-2 text-sm">
            <h3 className="font-semibold">{t("cabinet.results")}</h3>
            {others.map((item, index) => (
              <p key={item.id}>{t("cabinet.jury")} {index + 1}: {item.scores.reduce((sum, score) => sum + score.points, 0)} / 100. {item.publicComment}</p>
            ))}
          </section>
        ) : null}
      </article>
      <ScorePanel
        locale={locale}
        submissionId={submission.id}
        criteria={stage.criteria.map((criterion) => ({
          id: criterion.id,
          title: tr(locale, criterion.titleUz, criterion.titleRu, criterion.titleEn),
          description: tr(locale, criterion.descUz, criterion.descRu, criterion.descEn),
          maxPoints: criterion.maxPoints,
        }))}
        initial={{
          scores,
          strengths: evaluation?.strengths ?? [],
          improvements: evaluation?.improvements ?? [],
          nextSteps: evaluation?.nextSteps ?? "",
          publicComment: evaluation?.publicComment ?? "",
          internalNote: evaluation?.internalNote ?? "",
        }}
        finalized={Boolean(evaluation?.finalizedAt)}
        canScore={canScore}
        conflict={Boolean(assignment?.conflictDeclared)}
      />
    </div>
  );
}
