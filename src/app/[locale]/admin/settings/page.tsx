import { getTranslations, setRequestLocale } from "next-intl/server";
import { ActionForm } from "@/components/action-form";
import { Button, Card, Field, SelectInput, TextInput } from "@/components/ui";
import { getSettings } from "@/lib/settings";
import { savePlatformSettings, uploadTemplate } from "@/server/admin-actions";
import { prisma } from "@/lib/prisma";

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const settings = await getSettings();
  const template = await prisma.appSetting.findUnique({ where: { key: "prdTemplate" } });
  return (
    <div className="grid gap-4">
      <Card>
        <ActionForm action={savePlatformSettings} locale={locale} className="grid gap-3">
          <h2 className="font-semibold">{t("admin.featureFlags")}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="discrepancyThreshold" label={t("admin.threshold")}><TextInput id="discrepancyThreshold" name="discrepancyThreshold" type="number" defaultValue={settings.discrepancyThreshold} /></Field>
            <Field id="judgesPerSubmission" label={t("admin.judgesPer")}><TextInput id="judgesPerSubmission" name="judgesPerSubmission" type="number" defaultValue={settings.judgesPerSubmission} /></Field>
            <Field id="appealDays" label={t("admin.appealDays")}><TextInput id="appealDays" name="appealDays" type="number" defaultValue={settings.appealDays} /></Field>
            <Field id="contactEmail" label={t("admin.contactEmail")}><TextInput id="contactEmail" name="contactEmail" type="email" defaultValue={settings.contactEmail} /></Field>
            <Field id="scoreAggregate" label={t("admin.aggregate")}>
              <SelectInput id="scoreAggregate" name="scoreAggregate" defaultValue={settings.scoreAggregate}>
                <option value="average">{t("admin.average")}</option>
                <option value="median">{t("admin.median")}</option>
              </SelectInput>
            </Field>
          </div>
          <div className="grid gap-2 text-sm">
            {(["judgesCanScoreAny", "blindReview", "emailPasswordReset", "videoUploadEnabled"] as const).map((key) => (
              <label key={key} className="flex items-center gap-2">
                <input type="checkbox" name={key} defaultChecked={settings[key]} className="h-5 w-5" />
                <span>{t(`admin.${key === "judgesCanScoreAny" ? "assign" : key === "blindReview" ? "blind" : key === "emailPasswordReset" ? "emailReset" : "videoUpload"}`)}</span>
              </label>
            ))}
          </div>
          <h3 className="font-semibold">{t("admin.fileLimits")}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {(Object.keys(settings.maxFileMb) as (keyof typeof settings.maxFileMb)[]).map((kind) => (
              <Field key={kind} id={kind} label={`${kind} · ${t("admin.maxFile")}`}>
                <TextInput id={kind} name={kind} type="number" defaultValue={settings.maxFileMb[kind]} />
              </Field>
            ))}
          </div>
          <Button type="submit">{t("admin.saveSettings")}</Button>
        </ActionForm>
      </Card>
      <Card>
        <h2 className="font-semibold">{t("admin.prdTemplate")}</h2>
        <p className="mt-1 text-sm text-muted">{template ? t("common.yes") : t("errors.template_missing")}</p>
        <ActionForm action={uploadTemplate} locale={locale} className="mt-3 grid gap-3">
          <input type="file" name="file" accept="application/pdf,.pdf" required className="block w-full text-sm" />
          <Button type="submit">{t("admin.uploadTemplate")}</Button>
        </ActionForm>
      </Card>
    </div>
  );
}
