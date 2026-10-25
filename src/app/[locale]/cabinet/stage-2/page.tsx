import { getTranslations, setRequestLocale } from "next-intl/server";
import { Stage2Form } from "@/components/stage-forms";
import { Badge, Empty } from "@/components/ui";
import { lockReason, submissionMode } from "@/lib/deadlines";
import { signLocalFile } from "@/lib/storage";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/session";
import { loadCabinet } from "@/server/cabinet";
import { asBool, asRecord, asString } from "@/server/content";

export default async function Stage2Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRoles(locale, ["PARTICIPANT"]);
  const t = await getTranslations();
  const team = await loadCabinet(user.id);
  const stage = await prisma.stage.findUnique({ where: { key: "STAGE2" } });
  if (!stage || stage.status === "DRAFT") return <Empty>{t("errors.stage_not_open")}</Empty>;
  const stage1 = team?.project?.submissions.find((item) => item.stageKey === "STAGE1");
  const advanced = Boolean(stage1?.results.some((result) => result.advanced));
  if (!advanced) return <Empty>{t("cabinet.stage2Locked")}</Empty>;
  const submission = team?.project?.submissions.find((item) => item.stageKey === "STAGE2") ?? null;
  const now = new Date();
  const reason = lockReason(now, stage, submission);
  const mode = submissionMode(now, stage, submission);
  const payload = asRecord(submission?.payload);
  const checklist = asRecord(payload.checklist);
  const template = await prisma.appSetting.findUnique({ where: { key: "prdTemplate" } });
  const hasTemplate = Boolean(template?.value && typeof template.value === "object");
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-3xl font-semibold">{t("cabinet.stage2")}</h1>
        <Badge>{t(`status.${reason ?? submission?.status ?? "DRAFT"}`)}</Badge>
      </div>
      {hasTemplate ? <TemplateLink label={t("cabinet.template")} /> : (
        <p className="text-sm text-muted">{t("errors.template_missing")}</p>
      )}
      <ul className="grid gap-1 text-sm">
        {submission?.files.map((file) => (
          <li key={file.id}><a className="break-all underline" href={signLocalFile(file.id, 900)}>{file.originalName}</a></li>
        ))}
      </ul>
      <Stage2Form
        locale={locale}
        mode={mode}
        files={(submission?.files ?? []).map((file) => ({ kind: file.kind, name: file.originalName }))}
        initial={{
          softwareProject: asBool(payload.softwareProject),
          productUrl: asString(payload.productUrl),
          accessInstructions: asString(payload.accessInstructions),
          videoUrl: asString(payload.videoUrl),
          githubUrl: asString(payload.githubUrl),
          equivalentProof: asString(payload.equivalentProof),
          priorWork: asString(payload.priorWork),
          aiTools: asString(payload.aiTools),
          openSource: asString(payload.openSource),
          limitations: asString(payload.limitations),
          checklist,
        }}
      />
    </div>
  );
}

function TemplateLink({ label }: { label: string }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a className="inline-flex min-h-11 items-center text-sm font-semibold underline" href="/api/templates/prd">{label}</a>
    </>
  );
}
