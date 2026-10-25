import type { ContentSection, FaqItem } from "@/lib/payload";
import { contentSectionSchema, faqSchema } from "@/lib/payload";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

export async function publicData() {
  const [stages, tracks, criteria, announcements, settings, regulationRow, faqRow, contactRow] = await Promise.all([
    prisma.stage.findMany({ orderBy: { opensAt: "asc" } }),
    prisma.track.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.criterion.findMany({ orderBy: [{ stageKey: "asc" }, { order: "asc" }] }),
    prisma.announcement.findMany({ where: { publishedAt: { not: null } }, orderBy: { publishedAt: "desc" } }),
    getSettings(),
    prisma.appSetting.findUnique({ where: { key: "content.regulation" } }),
    prisma.appSetting.findUnique({ where: { key: "content.faq" } }),
    prisma.appSetting.findUnique({ where: { key: "content.contacts" } }),
  ]);
  const regulation = Array.isArray(regulationRow?.value)
    ? regulationRow.value.flatMap((item) => {
        const parsed = contentSectionSchema.safeParse(item);
        return parsed.success ? [parsed.data] : [];
      })
    : [] as ContentSection[];
  const faq = Array.isArray(faqRow?.value)
    ? faqRow.value.flatMap((item) => {
        const parsed = faqSchema.safeParse(item);
        return parsed.success ? [parsed.data] : [];
      })
    : [] as FaqItem[];
  const contacts = contactRow?.value && typeof contactRow.value === "object" && !Array.isArray(contactRow.value)
    ? contactRow.value as { orgUz: string; orgRu: string; orgEn: string; cityUz: string; cityRu: string; cityEn: string }
    : null;
  return { stages, tracks, criteria, announcements, settings, regulation, faq, contacts };
}
