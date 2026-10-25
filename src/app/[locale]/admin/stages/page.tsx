import { getTranslations, setRequestLocale } from "next-intl/server";
import { ActionForm } from "@/components/action-form";
import { Button, Field, SelectInput, TextInput } from "@/components/ui";
import { updateStage } from "@/server/admin-actions";
import { prisma } from "@/lib/prisma";
import { utcToTashkentInput } from "@/lib/time";

export default async function StagesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const stages = await prisma.stage.findMany({ orderBy: { opensAt: "asc" } });
  const statuses = ["DRAFT", "OPEN", "CLOSED", "EVALUATING", "PUBLISHED"] as const;
  return (
    <div className="grid gap-4">
      {stages.map((stage) => (
        <ActionForm key={stage.id} action={updateStage} locale={locale} className="grid gap-3 rounded-3xl border border-border bg-card p-4">
          <h2 className="text-xl font-semibold">{t(`status.${stage.key}`)}</h2>
          <input type="hidden" name="key" value={stage.key} />
          <p className="text-sm text-muted">{t("admin.stageDates")}</p>
          <div className="grid gap-3 md:grid-cols-3">
            <Field id={`${stage.id}-open`} label={t("admin.openStage")}><TextInput id={`${stage.id}-open`} name="opensAt" type="datetime-local" defaultValue={utcToTashkentInput(stage.opensAt)} required /></Field>
            <Field id={`${stage.id}-update`} label={t("admin.updateDeadline")}><TextInput id={`${stage.id}-update`} name="updateDeadlineAt" type="datetime-local" defaultValue={utcToTashkentInput(stage.updateDeadlineAt)} required /></Field>
            <Field id={`${stage.id}-deadline`} label={t("admin.deadline")}><TextInput id={`${stage.id}-deadline`} name="deadlineAt" type="datetime-local" defaultValue={utcToTashkentInput(stage.deadlineAt)} required /></Field>
          </div>
          <Field id={`${stage.id}-status`} label={t("common.status")}>
            <SelectInput id={`${stage.id}-status`} name="status" defaultValue={stage.status} disabled={stage.status === "PUBLISHED"}>
              {statuses.map((status) => <option key={status} value={status}>{t(`status.${status}`)}</option>)}
            </SelectInput>
          </Field>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirm" className="mt-1 h-5 w-5" required /><span>{t("common.confirmBox")}</span></label>
          <Button type="submit" disabled={stage.status === "PUBLISHED"}>{t("admin.transition")}</Button>
        </ActionForm>
      ))}
    </div>
  );
}
