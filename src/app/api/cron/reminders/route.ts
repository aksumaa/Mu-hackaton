import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendDeadlineReminders } from "@/server/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  if (!secret || header !== `Bearer ${secret}`) return new NextResponse("forbidden", { status: 403 });
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN", isActive: true }, orderBy: { createdAt: "asc" } });
  if (!admin) return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });
  const result = await sendDeadlineReminders(admin.id);
  return NextResponse.json(result);
}
