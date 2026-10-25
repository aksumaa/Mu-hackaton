import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export async function currentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.isActive) return null;
  return user;
}

function leave(locale: string, href: string): never {
  redirect({ href, locale });
  throw new Error("redirect");
}

export async function requireUser(locale: string) {
  const user = await currentUser();
  if (!user) leave(locale, "/login");
  if (user.mustChangePassword) leave(locale, "/change-password");
  return user;
}

export async function requireRoles(locale: string, roles: Role[]) {
  const user = await requireUser(locale);
  if (!roles.includes(user.role)) leave(locale, "/");
  return user;
}
