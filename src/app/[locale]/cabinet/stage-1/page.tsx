import { getTranslations, setRequestLocale } from "next-intl/server";
import { Stage1Form } from "@/components/stage-forms";
import { Badge, Empty } from "@/components/ui";
import { lockReason, submissionMode } from "@/lib/deadlines";
import { tr } from "@/lib/locale-text";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/session";
import { formatTashkent } from "@/lib/time";
import { loadCabinet } from "@/server/cabinet";
import { stage1FromPayload } from "@/lib/payload";

export default async function Stage1Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRoles(locale, ["PARTICIPANT"]);
  const t = await getTranslations();
  const [team, tracks, stage] = await Promise.all([
    loadCabinet(user.id),
    prisma.track.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.stage.findUnique({ where: { key: "STAGE1" } }),
  ]);
  if (!team || !stage || tracks.length === 0) return <Empty>{t("common.empty")}</Empty>;
  const submission = team.project?.submissions.find((item) => item.stageKey === "STAGE1") ?? null;
  const now = new Date();
  const reason = lockReason(now, stage, submission);
  const mode = submissionMode(now, stage, submission);
  const initial = stage1FromPayload(submission?.payload);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-3xl font-semibold">{t("cabinet.stage1")}</h1>
        <Badge>{t(`status.${reason ?? submission?.status ?? "DRAFT"}`)}</Badge>
      </div>
      <p className="text-sm text-muted">{t("admin.deadline")}: {formatTashkent(stage.deadlineAt)} · {t("admin.updateDeadline")}: {formatTashkent(stage.updateDeadlineAt)}</p>
      <p className="text-sm">{mode === "update" ? t("cabinet.updateRemaining") : submission?.updateUsedAt ? t("cabinet.updateUsed") : t("cabinet.draftHint")}</p>
      <Stage1Form
        locale={locale}
        mode={mode}
        tracks={tracks.map((track) => ({ id: track.id, name: tr(locale, track.nameUz, track.nameRu, track.nameEn) }))}
        canLead={team.leaderId === user.id}
        initial={{ ...initial, trackId: team.project?.trackId || tracks[0]!.id }}
      />
    </div>
  );
}
