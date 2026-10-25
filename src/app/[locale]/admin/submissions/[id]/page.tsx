import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { signLocalFile } from "@/lib/storage";
import { formatTashkent } from "@/lib/time";
import { reopenEvaluation } from "@/server/admin-actions";
import { asRecord } from "@/server/content";

export default async function SubmissionAdminPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const submission = await prisma.submission.findUnique({
    where: { id },
    include: {
      project: { include: { team: { include: { members: true } }, track: true } },
      files: { where: { isCurrent: true } },
      links: { where: { isCurrent: true } },
      assignments: { include: { judge: true, evaluation: { include: { scores: { include: { criterion: true } } } } } },
    },
  });
  if (!submission) notFound();
  const payload = asRecord(submission.payload);
  return (
    <div className="grid gap-4">
      <Link href="/admin/submissions" className="text-sm font-semibold underline">{t("common.back")}</Link>
      <h2 className="break-words text-2xl font-semibold">{submission.project.title}</h2>
      <p className="text-sm">{submission.project.team.name} · {submission.project.team.members.map((member) => member.fullName).join(", ")}</p>
      <p className="text-sm tabular-nums">{t("cabinet.submittedAt")}: {submission.firstSubmittedAt ? formatTashkent(submission.firstSubmittedAt) : t("common.none")} · {t("cabinet.updatedAt")}: {submission.updateUsedAt ? formatTashkent(submission.updateUsedAt) : t("common.none")}</p>
      <a className="inline-flex min-h-11 items-center font-semibold underline" href={`/api/admin/submissions/${submission.id}/zip`}>{t("admin.downloadZip")}</a>
      <Card>
        {Object.entries(payload).map(([key, value]) => (
          <p key={key} className="mt-2 whitespace-pre-wrap break-words text-sm"><span className="font-semibold">{key}: </span>{typeof value === "string" ? value : JSON.stringify(value)}</p>
        ))}
        <ul className="mt-3 grid gap-1 text-sm">
          {submission.links.map((link) => <li key={link.id} className="break-all">{link.kind}: {link.url}</li>)}
          {submission.files.map((file) => <li key={file.id}><a className="break-all underline" href={signLocalFile(file.id, 900)}>{file.originalName}</a></li>)}
        </ul>
      </Card>
      {submission.assignments.map((assignment) => (
        <Card key={assignment.id}>
          <p className="font-semibold">{assignment.judge.fullName} {assignment.conflictDeclared ? `· ${t("admin.conflict")}` : ""}</p>
          {assignment.evaluation ? (
            <>
              <p className="mt-2 text-sm tabular-nums">{assignment.evaluation.scores.reduce((sum, score) => sum + score.points, 0)} / 100</p>
              <ul className="mt-2 text-sm">
                {assignment.evaluation.scores.map((score) => <li key={score.id}>{score.criterion.key}: {score.points} / {score.criterion.maxPoints}</li>)}
              </ul>
              <p className="mt-2 whitespace-pre-wrap text-sm">{assignment.evaluation.internalNote}</p>
              {assignment.evaluation.finalizedAt ? (
                <form action={reopenEvaluation} className="mt-3">
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="evaluationId" value={assignment.evaluation.id} />
                  <button type="submit" className="min-h-11 rounded-full border border-border px-4 text-sm font-semibold">{t("admin.reopen")}</button>
                </form>
              ) : null}
            </>
          ) : <p className="text-sm text-muted">{t("judge.notStarted")}</p>}
        </Card>
      ))}
    </div>
  );
}
