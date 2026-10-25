import { getTranslations, setRequestLocale } from "next-intl/server";
import { ActionForm } from "@/components/action-form";
import { Button, Card } from "@/components/ui";
import { importRoster } from "@/server/admin-actions";

export default async function RosterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  return (
    <Card>
      <h2 className="text-xl font-semibold">{t("admin.roster")}</h2>
      <p className="mt-2 text-sm text-muted">{t("admin.csvHelp")}</p>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a className="mt-3 inline-flex min-h-11 items-center font-semibold underline" href="/api/admin/roster-template">{t("admin.downloadTemplate")}</a>
      <ActionForm action={importRoster} locale={locale} className="mt-4 grid gap-3">
        <input name="file" type="file" accept=".csv,text/csv" required className="block w-full text-sm" />
        <Button type="submit">{t("admin.import")}</Button>
      </ActionForm>
    </Card>
  );
}
