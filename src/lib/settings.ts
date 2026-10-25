import type { FileKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type PlatformSettings = {
  maxFileMb: Record<FileKind, number>;
  discrepancyThreshold: number;
  judgesPerSubmission: number;
  scoreAggregate: "average" | "median";
  judgesCanScoreAny: boolean;
  blindReview: boolean;
  emailPasswordReset: boolean;
  videoUploadEnabled: boolean;
  contactEmail: string;
  appealDays: number;
};

export const defaultSettings: PlatformSettings = {
  maxFileMb: {
    PRD_PDF: 15,
    PITCH_DECK: 30,
    VIDEO_FILE: 50,
    EQUIVALENT_PROOF: 30,
    OTHER: 15,
  },
  discrepancyThreshold: 20,
  judgesPerSubmission: 2,
  scoreAggregate: "average",
  judgesCanScoreAny: false,
  blindReview: false,
  emailPasswordReset: false,
  videoUploadEnabled: true,
  contactEmail: "",
  appealDays: 3,
};

export async function getSettings(): Promise<PlatformSettings> {
  const row = await prisma.appSetting.findUnique({ where: { key: "platform" } });
  if (!row || typeof row.value !== "object" || row.value === null || Array.isArray(row.value)) {
    return defaultSettings;
  }
  return { ...defaultSettings, ...(row.value as Partial<PlatformSettings>), maxFileMb: { ...defaultSettings.maxFileMb, ...((row.value as { maxFileMb?: PlatformSettings["maxFileMb"] }).maxFileMb ?? {}) } };
}

export async function saveSettings(value: PlatformSettings) {
  await prisma.appSetting.upsert({
    where: { key: "platform" },
    create: { key: "platform", value },
    update: { value },
  });
}
