"use server";

import { Prisma } from "@prisma/client";
import argon2 from "argon2";
import { headers } from "next/headers";
import { CredentialsSignin } from "next-auth";
import { signIn, signOut } from "@/auth";
import { audit } from "@/lib/audit";
import { homeFor } from "@/lib/locale-text";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { redirect } from "@/i18n/navigation";
import { clientIp, normalizeGroup } from "@/lib/utils";
import { changePasswordSchema, loginSchema, registerSchema } from "@/lib/validation";
import { checked, localeOf, rethrowRedirect, text, type ActionState } from "@/server/action-state";

function safeNext(raw: string, locale: string, role: "PARTICIPANT" | "JUDGE" | "ADMIN") {
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || raw.includes("://") || raw.includes("?")) return null;
  const prefix = `/${locale}`;
  if (raw !== prefix && !raw.startsWith(`${prefix}/`)) return null;
  const path = raw === prefix ? "/" : raw.slice(prefix.length);
  const roots = role === "ADMIN" ? ["/admin"] : role === "JUDGE" ? ["/judge"] : ["/cabinet", "/change-password"];
  if (!roots.some((root) => path === root || path.startsWith(`${root}/`))) return null;
  return path;
}

async function establishSession(studentId: string, password: string, locale: string, href: string): Promise<ActionState> {
  try {
    const destination = await signIn("credentials", {
      studentId,
      password,
      redirect: false,
      redirectTo: `/${locale}${href}`,
    });
    if (typeof destination !== "string" || destination.includes("error=")) return { error: "invalid_credentials" };
  } catch (error) {
    rethrowRedirect(error);
    if (error instanceof CredentialsSignin && error.code === "rate_limited") return { error: "rate_limited" };
    if (error instanceof CredentialsSignin && error.code === "inactive") return { error: "inactive" };
    return { error: "invalid_credentials" };
  }
  redirect({ href, locale });
  return { error: "generic" };
}

async function verificationFor(studentId: string, facultyId: string, groupName: string) {
  const roster = await prisma.rosterEntry.findUnique({ where: { studentId } });
  if (!roster) return "PENDING" as const;
  if (roster.facultyId === facultyId && normalizeGroup(roster.groupName) === normalizeGroup(groupName)) return "VERIFIED" as const;
  return "PENDING" as const;
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = localeOf(formData);
  const parsed = loginSchema.safeParse({
    studentId: text(formData, "studentId"),
    password: text(formData, "password"),
  });
  if (!parsed.success) return { error: "invalid_field", field: "studentId" };
  const user = await prisma.user.findFirst({ where: { studentId: { equals: parsed.data.studentId, mode: "insensitive" } } });
  const matches = user ? await argon2.verify(user.passwordHash, parsed.data.password).catch(() => false) : false;
  if (!user || !matches || !user.isActive) {
    const limit = rateLimit(`login:${clientIp(await headers())}`);
    if (!limit.ok) return { error: "rate_limited" };
    if (user && matches && !user.isActive) return { error: "inactive" };
    return { error: "invalid_credentials" };
  }
  const requested = safeNext(text(formData, "next"), locale, user.role);
  const nextPath = user.mustChangePassword ? "/change-password" : requested ?? homeFor(user.role);
  return establishSession(user.studentId, parsed.data.password, locale, nextPath);
}

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = localeOf(formData);
  const parsed = registerSchema.safeParse({
    fullName: text(formData, "fullName"),
    studentId: text(formData, "studentId"),
    facultyId: text(formData, "facultyId"),
    course: text(formData, "course"),
    groupName: text(formData, "groupName"),
    phone: text(formData, "phone"),
    telegram: text(formData, "telegram"),
    email: text(formData, "email"),
    password: text(formData, "password"),
    acceptRules: checked(formData, "acceptRules"),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue?.message === "phone_or_telegram") return { error: "phone_or_telegram", field: "phone" };
    if (issue?.path[0] === "acceptRules") return { error: "accept_rules", field: "acceptRules" };
    return { error: "invalid_field", field: String(issue?.path[0] ?? "fullName") };
  }
  const limit = rateLimit(`register:${clientIp(await headers())}`);
  if (!limit.ok) return { error: "rate_limited" };
  const data = parsed.data;
  const status = await verificationFor(data.studentId, data.facultyId, data.groupName);
  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          studentId: data.studentId,
          fullName: data.fullName,
          passwordHash: await argon2.hash(data.password),
          phone: data.phone || null,
          telegram: data.telegram || null,
          email: data.email || null,
          facultyId: data.facultyId,
          course: data.course,
          groupName: data.groupName,
          locale,
          role: "PARTICIPANT",
        },
      });
      const team = await tx.team.create({ data: { leaderId: user.id, name: data.fullName } });
      await tx.teamMember.create({
        data: {
          teamId: team.id,
          userId: user.id,
          fullName: data.fullName,
          studentId: data.studentId,
          facultyId: data.facultyId,
          course: data.course,
          groupName: data.groupName,
          verificationStatus: status,
          isLeader: true,
          teamRole: "TEAM_LEADER",
        },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.user.findUnique({ where: { studentId: data.studentId } });
      if (existing && (await argon2.verify(existing.passwordHash, data.password).catch(() => false))) {
        return establishSession(data.studentId, data.password, locale, "/cabinet");
      }
      return { error: "student_id_taken", field: "studentId" };
    }
    return { error: "generic" };
  }
  return establishSession(data.studentId, data.password, locale, "/cabinet");
}

export async function changePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = localeOf(formData);
  const { auth } = await import("@/auth");
  const session = await auth();
  if (!session?.user?.id) {
    redirect({ href: "/login", locale });
    return { error: "generic" };
  }
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.isActive) {
    redirect({ href: "/login", locale });
    return { error: "generic" };
  }
  const parsed = changePasswordSchema.safeParse({
    currentPassword: text(formData, "currentPassword"),
    nextPassword: text(formData, "nextPassword"),
    confirmPassword: text(formData, "confirmPassword"),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue?.message === "passwords_mismatch") return { error: "passwords_mismatch", field: "confirmPassword" };
    return { error: "invalid_field", field: String(issue?.path[0] ?? "nextPassword") };
  }
  const matches = await argon2.verify(user.passwordHash, parsed.data.currentPassword).catch(() => false);
  if (!matches) return { error: "password_wrong", field: "currentPassword" };
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await argon2.hash(parsed.data.nextPassword), mustChangePassword: false },
  });
  await audit({ actorId: user.id, action: "password_changed", entity: "User", entityId: user.id });
  redirect({ href: homeFor(user.role), locale });
  return { ok: true };
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

export async function requestResetAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = localeOf(formData);
  const { requestPasswordReset } = await import("@/server/participant");
  const result = await requestPasswordReset(text(formData, "studentId").trim().toUpperCase(), locale);
  if (!result.ok) return { error: result.code };
  return { ok: true, notice: "reset_sent" };
}

export async function resetWithTokenAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = localeOf(formData);
  const nextPassword = text(formData, "nextPassword");
  const confirmPassword = text(formData, "confirmPassword");
  if (nextPassword.length < 8) return { error: "invalid_field", field: "nextPassword" };
  if (nextPassword !== confirmPassword) return { error: "passwords_mismatch", field: "confirmPassword" };
  const { resetPasswordWithToken } = await import("@/server/participant");
  const result = await resetPasswordWithToken(text(formData, "token"), nextPassword);
  if (!result.ok) return { error: result.code };
  redirect({ href: "/login", locale });
  return { ok: true };
}
