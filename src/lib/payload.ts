import { z } from "zod";
import { CHECKLIST_KEYS, type ChecklistKey } from "@/lib/catalog";
import { stage1DraftSchema, stage2Schema } from "@/lib/validation";

const checklistDefaults = Object.fromEntries(CHECKLIST_KEYS.map((key) => [key, false])) as Record<ChecklistKey, boolean>;

export function readStage1(payload: unknown, fallback: { title: string; trackId: string }) {
  const source = typeof payload === "object" && payload ? payload as Record<string, unknown> : {};
  const parsed = stage1DraftSchema.safeParse({
    shortDescription: "",
    problem: "",
    audience: "",
    solution: "",
    differentiation: "",
    validation: "",
    teamRoles: "",
    consent: false,
    ...source,
    title: typeof source.title === "string" ? source.title : fallback.title,
    trackId: typeof source.trackId === "string" ? source.trackId : fallback.trackId,
  });
  if (parsed.success) return parsed.data;
  return {
    title: fallback.title,
    trackId: fallback.trackId,
    shortDescription: "",
    problem: "",
    audience: "",
    solution: "",
    differentiation: "",
    validation: "",
    teamRoles: "",
    consent: false,
  };
}

export function readStage2(payload: unknown) {
  const source = typeof payload === "object" && payload ? payload as Record<string, unknown> : {};
  const checklist = typeof source.checklist === "object" && source.checklist ? source.checklist as Record<string, unknown> : {};
  const parsed = stage2Schema.safeParse({
    softwareProject: true,
    productUrl: "",
    accessInstructions: "",
    videoUrl: "",
    githubUrl: "",
    equivalentProof: "",
    priorWork: "",
    aiTools: "",
    openSource: "",
    limitations: "",
    ...source,
    checklist: { ...checklistDefaults, ...Object.fromEntries(CHECKLIST_KEYS.map((key) => [key, checklist[key] === true])) },
  });
  if (parsed.success) return parsed.data;
  return {
    softwareProject: true,
    productUrl: "",
    accessInstructions: "",
    videoUrl: "",
    githubUrl: "",
    equivalentProof: "",
    priorWork: "",
    aiTools: "",
    openSource: "",
    limitations: "",
    checklist: checklistDefaults,
  };
}

export const contentSectionSchema = z.object({
  id: z.string().min(1),
  titleUz: z.string().min(1),
  titleRu: z.string().min(1),
  titleEn: z.string().min(1),
  bodyUz: z.string().min(1),
  bodyRu: z.string().min(1),
  bodyEn: z.string().min(1),
});

export const faqSchema = z.object({
  id: z.string().min(1),
  qUz: z.string().min(1),
  qRu: z.string().min(1),
  qEn: z.string().min(1),
  aUz: z.string().min(1),
  aRu: z.string().min(1),
  aEn: z.string().min(1),
});

export type ContentSection = z.infer<typeof contentSectionSchema>;
export type FaqItem = z.infer<typeof faqSchema>;

export function stage1FromPayload(value: unknown) {
  const payload = typeof value === "object" && value && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return {
    title: typeof payload.title === "string" ? payload.title : "",
    shortDescription: typeof payload.shortDescription === "string" ? payload.shortDescription : "",
    problem: typeof payload.problem === "string" ? payload.problem : "",
    audience: typeof payload.audience === "string" ? payload.audience : "",
    solution: typeof payload.solution === "string" ? payload.solution : "",
    differentiation: typeof payload.differentiation === "string" ? payload.differentiation : "",
    validation: typeof payload.validation === "string" ? payload.validation : "",
    teamRoles: typeof payload.teamRoles === "string" ? payload.teamRoles : "",
    consent: payload.consent === true,
  };
}
