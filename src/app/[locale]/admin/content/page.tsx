import { getTranslations, setRequestLocale } from "next-intl/server";
import { ActionForm } from "@/components/action-form";
import { Button, Card, Field, TextArea, TextInput } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { addAnnouncement, saveSiteContent } from "@/server/admin-actions";
import { messages } from "@/i18n/messages";
import { getContent } from "@/server/content";

export default async function ContentPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const [content, tracks, faculties, announcements] = await Promise.all([
    getContent(),
    prisma.track.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.faculty.findMany({ orderBy: { nameEn: "asc" } }),
    prisma.announcement.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  const regulation = content?.regulation ?? {
    uz: paragraph("uz"),
    ru: paragraph("ru"),
    en: paragraph("en"),
  };
  const faq = content?.faq ?? [];
  return (
    <div className="grid gap-4">
      <ActionForm action={saveSiteContent} locale={locale} className="grid gap-4">
        <Card>
          <h2 className="font-semibold">{t("admin.regulation")}</h2>
          {(["uz", "ru", "en"] as const).map((lang) => (
            <Field key={lang} id={`reg${lang}`} label={lang.toUpperCase()}>
              <TextArea id={`reg${lang}`} name={`reg${lang === "uz" ? "Uz" : lang === "ru" ? "Ru" : "En"}`} defaultValue={regulation[lang]} />
            </Field>
          ))}
        </Card>
        <Card>
          <h2 className="font-semibold">{t("admin.faqEdit")}</h2>
          {Array.from({ length: Math.min(12, Math.max(faq.length + 1, 1)) }, (_, index) => {
            const item = faq[index];
            return (
              <div key={index} className="mt-3 grid gap-2 border-t border-border pt-3">
                {(["Uz", "Ru", "En"] as const).map((lang) => (
                  <div key={lang} className="grid gap-2 sm:grid-cols-2">
                    <Field id={`q${lang}_${index}`} label={`${t("admin.question")} ${lang}`}>
                      <TextInput id={`q${lang}_${index}`} name={`q${lang}_${index}`} defaultValue={item?.[`q${lang}`] ?? ""} />
                    </Field>
                    <Field id={`a${lang}_${index}`} label={`${t("admin.answer")} ${lang}`}>
                      <TextInput id={`a${lang}_${index}`} name={`a${lang}_${index}`} defaultValue={item?.[`a${lang}`] ?? ""} />
                    </Field>
                  </div>
                ))}
              </div>
            );
          })}
        </Card>
        <Card>
          <h2 className="font-semibold">{t("admin.tracksEdit")}</h2>
          {tracks.map((track) => (
            <div key={track.id} className="mt-3 grid gap-2 border-t border-border pt-3">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name={`track_${track.id}_active`} defaultChecked={track.isActive} className="h-5 w-5" />{t("admin.active")}</label>
              {(["uz", "ru", "en"] as const).map((lang) => (
                <Field key={lang} id={`track-${track.id}-${lang}`} label={lang.toUpperCase()}>
                  <TextInput id={`track-${track.id}-${lang}`} name={`track_${track.id}_${lang}`} defaultValue={lang === "uz" ? track.nameUz : lang === "ru" ? track.nameRu : track.nameEn} />
                </Field>
              ))}
              {(["uz", "ru", "en"] as const).map((lang) => (
                <Field key={`${track.id}-d-${lang}`} id={`track-${track.id}-d${lang}`} label={`${t("admin.description")} ${lang.toUpperCase()}`}>
                  <TextArea
                    id={`track-${track.id}-d${lang}`}
                    name={`track_${track.id}_d${lang}`}
                    defaultValue={lang === "uz" ? track.descUz : lang === "ru" ? track.descRu : track.descEn}
                  />
                </Field>
              ))}
            </div>
          ))}
        </Card>
        <Card>
          <h2 className="font-semibold">{t("admin.facultiesEdit")}</h2>
          {faculties.map((faculty) => (
            <div key={faculty.id} className="mt-3 grid gap-2">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name={`faculty_${faculty.id}_active`} defaultChecked={faculty.isActive} className="h-5 w-5" />{faculty.nameEn}</label>
              <div className="grid gap-2 sm:grid-cols-3">
                <TextInput name={`faculty_${faculty.id}_uz`} defaultValue={faculty.nameUz} aria-label={`${faculty.nameEn} uz`} />
                <TextInput name={`faculty_${faculty.id}_ru`} defaultValue={faculty.nameRu} aria-label={`${faculty.nameEn} ru`} />
                <TextInput name={`faculty_${faculty.id}_en`} defaultValue={faculty.nameEn} aria-label={`${faculty.nameEn} en`} />
              </div>
            </div>
          ))}
        </Card>
        <Button type="submit">{t("admin.saveContent")}</Button>
      </ActionForm>
      <Card>
        <h2 className="font-semibold">{t("admin.announcements")}</h2>
        <ActionForm action={addAnnouncement} locale={locale} className="mt-3 grid gap-2">
          {(["Uz", "Ru", "En"] as const).map((lang) => (
            <div key={lang} className="grid gap-2">
              <Field id={`title${lang}`} label={`${t("admin.name")} ${lang}`}><TextInput id={`title${lang}`} name={`title${lang}`} required /></Field>
              <Field id={`body${lang}`} label={`${t("admin.body")} ${lang}`}><TextArea id={`body${lang}`} name={`body${lang}`} /></Field>
            </div>
          ))}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="publish" defaultChecked className="h-5 w-5" />{t("admin.published")}</label>
          <Button type="submit">{t("admin.addAnnouncement")}</Button>
        </ActionForm>
        <ul className="mt-4 grid gap-2 text-sm">
          {announcements.map((item) => <li key={item.id} className="break-words">{item.titleEn} {item.publishedAt ? `· ${t("admin.published")}` : ""}</li>)}
        </ul>
      </Card>
    </div>
  );
}

function paragraph(locale: "uz" | "ru" | "en") {
  return [1, 2, 3, 4, 5, 6, 7, 8].map((index) => messages[locale].regulation[`p${index}` as "p1"]).join("\n\n");
}
