import { getTranslations, setRequestLocale } from "next-intl/server";
import { ActionForm } from "@/components/action-form";
import { Button, Card, Field, TextArea, TextInput } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { deleteJudgeProfile, saveJudgeProfile } from "@/server/admin-actions";

export default async function JuryAdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const rows = await prisma.judgeProfile.findMany({ orderBy: [{ order: "asc" }, { displayName: "asc" }] });
  const blank = { id: "", displayName: "", title: "", organization: "", photoUrl: "", bio: "", order: rows.length, isPublished: false };
  return (
    <div className="grid gap-4">
      {[...rows, blank].map((row) => (
        <Card key={row.id || "new"}>
          <h2 className="font-semibold">{row.id ? row.displayName : t("admin.juryNew")}</h2>
          <ActionForm action={saveJudgeProfile} locale={locale}>
            {row.id ? <input type="hidden" name="id" value={row.id} /> : null}
            <Field id={`name-${row.id || "new"}`} label={t("admin.juryName")}>
              <TextInput id={`name-${row.id || "new"}`} name="displayName" defaultValue={row.displayName} required />
            </Field>
            <Field id={`title-${row.id || "new"}`} label={t("admin.juryTitle")}>
              <TextInput id={`title-${row.id || "new"}`} name="title" defaultValue={row.title} required />
            </Field>
            <Field id={`org-${row.id || "new"}`} label={t("admin.juryOrg")}>
              <TextInput id={`org-${row.id || "new"}`} name="organization" defaultValue={row.organization} required />
            </Field>
            <Field id={`photo-${row.id || "new"}`} label={t("admin.juryPhoto")}>
              <TextInput id={`photo-${row.id || "new"}`} name="photoUrl" defaultValue={row.photoUrl ?? ""} placeholder="https://" />
            </Field>
            <Field id={`bio-${row.id || "new"}`} label={t("admin.juryBio")}>
              <TextArea id={`bio-${row.id || "new"}`} name="bio" defaultValue={row.bio} />
            </Field>
            <Field id={`order-${row.id || "new"}`} label={t("admin.juryOrder")}>
              <TextInput id={`order-${row.id || "new"}`} name="order" type="number" min={0} max={999} defaultValue={row.order} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isPublished" defaultChecked={row.isPublished} className="h-5 w-5" />
              {t("admin.juryPublished")}
            </label>
            <Button type="submit">{t("common.save")}</Button>
          </ActionForm>
          {row.id ? (
            <ActionForm action={deleteJudgeProfile} locale={locale} className="mt-3">
              <input type="hidden" name="id" value={row.id} />
              <Button type="submit" variant="danger">{t("common.remove")}</Button>
            </ActionForm>
          ) : null}
        </Card>
      ))}
    </div>
  );
}
