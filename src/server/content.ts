import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type FaqItem = {
  qUz: string;
  qRu: string;
  qEn: string;
  aUz: string;
  aRu: string;
  aEn: string;
};

export type SiteContent = {
  regulation: { uz: string; ru: string; en: string };
  faq: FaqItem[];
};

export async function getContent(): Promise<SiteContent | null> {
  const row = await prisma.appSetting.findUnique({ where: { key: "content" } });
  if (!row || typeof row.value !== "object" || row.value === null || Array.isArray(row.value)) return null;
  const value = row.value as Partial<SiteContent>;
  if (!value.regulation?.uz || !Array.isArray(value.faq)) return null;
  return { regulation: value.regulation, faq: value.faq };
}

export async function saveContent(value: SiteContent) {
  await prisma.appSetting.upsert({
    where: { key: "content" },
    create: { key: "content", value: value as unknown as Prisma.InputJsonValue },
    update: { value: value as unknown as Prisma.InputJsonValue },
  });
}

export function asRecord(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

export function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function asBool(value: unknown) {
  return value === true;
}
