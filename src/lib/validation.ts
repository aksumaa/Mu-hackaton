import { z } from "zod";
import { CHECKLIST_KEYS } from "@/lib/catalog";

const studentId = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s\u200B-\u200D\uFEFF]/g, "").toUpperCase())
  .pipe(z.string().min(4).max(32).regex(/^[A-Z0-9-]+$/));
const personName = z.string().trim().min(3).max(120);
const groupName = z.string().trim().min(2).max(32);
const course = z.coerce.number().int().min(1).max(6);
const password = z.string().min(8).max(128);
const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

export const registerSchema = z
  .object({
    fullName: personName,
    studentId,
    facultyId: z.string().min(1),
    course,
    groupName,
    phone: optionalText(64),
    telegram: optionalText(64),
    email: z.union([z.string().trim().email().max(160), z.literal("")]).optional(),
    password,
    acceptRules: z.literal(true),
  })
  .refine((value) => Boolean(value.phone) || Boolean(value.telegram), { path: ["phone"], message: "phone_or_telegram" });

export const loginSchema = z.object({
  studentId,
  password: z.string().min(1).max(128),
});

export const memberSchema = z.object({
  fullName: personName,
  studentId,
  facultyId: z.string().min(1),
  course,
  groupName,
});

export const memberAccountSchema = memberSchema.extend({
  password,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    nextPassword: password,
    confirmPassword: z.string().min(8).max(128),
  })
  .refine((value) => value.nextPassword === value.confirmPassword, { path: ["confirmPassword"], message: "passwords_mismatch" });

export const stage1Schema = z.object({
  title: z.string().trim().min(3).max(120),
  trackId: z.string().min(1),
  shortDescription: z.string().trim().min(20).max(500),
  problem: z.string().trim().min(30).max(3000),
  audience: z.string().trim().min(20).max(2000),
  solution: z.string().trim().min(30).max(4000),
  differentiation: z.string().trim().min(20).max(2000),
  validation: z.string().trim().min(10).max(2000),
  teamRoles: z.string().trim().min(5).max(1500),
  consent: z.literal(true),
});

export const stage1DraftSchema = z.object({
  title: z.string().trim().max(120),
  trackId: z.string().min(1),
  shortDescription: z.string().trim().max(500),
  problem: z.string().trim().max(3000),
  audience: z.string().trim().max(2000),
  solution: z.string().trim().max(4000),
  differentiation: z.string().trim().max(2000),
  validation: z.string().trim().max(2000),
  teamRoles: z.string().trim().max(1500),
  consent: z.boolean(),
});

const checklistShape = Object.fromEntries(CHECKLIST_KEYS.map((key) => [key, z.boolean()])) as Record<
  (typeof CHECKLIST_KEYS)[number],
  z.ZodBoolean
>;

export const stage2Schema = z.object({
  softwareProject: z.boolean(),
  productUrl: z.string().trim().max(500),
  accessInstructions: z.string().trim().max(2000),
  videoUrl: z.string().trim().max(500),
  githubUrl: z.string().trim().max(500),
  equivalentProof: z.string().trim().max(3000),
  priorWork: z.string().trim().max(3000),
  aiTools: z.string().trim().max(2000),
  openSource: z.string().trim().max(3000),
  limitations: z.string().trim().max(2000),
  checklist: z.object(checklistShape),
});

export const feedbackSchema = z.object({
  strengths: z.array(z.string().trim().min(1).max(400)).max(3),
  improvements: z.array(z.string().trim().min(1).max(400)).max(3),
  nextSteps: z.string().trim().max(1000),
  publicComment: z.string().trim().max(2000),
  internalNote: z.string().trim().max(2000),
  scores: z.array(z.object({ criterionId: z.string(), points: z.number().int() })),
});

export const stageDatesSchema = z
  .object({
    opensAt: z.string().min(1),
    updateDeadlineAt: z.string().min(1),
    deadlineAt: z.string().min(1),
  })
  .refine((value) => new Date(value.opensAt) < new Date(value.updateDeadlineAt) && new Date(value.updateDeadlineAt) <= new Date(value.deadlineAt), {
    path: ["updateDeadlineAt"],
    message: "invalid_dates",
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type Stage1Draft = z.infer<typeof stage1DraftSchema>;
export type Stage2Input = z.infer<typeof stage2Schema>;
