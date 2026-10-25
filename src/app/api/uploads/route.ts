import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { storeSubmissionFile } from "@/server/judge";
import type { FileKind } from "@prisma/client";

export const runtime = "nodejs";

const kinds = new Set<FileKind>(["PRD_PDF", "PITCH_DECK", "VIDEO_FILE", "EQUIVALENT_PROOF", "OTHER"]);

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) {
    return NextResponse.json({ ok: false, code: "forbidden" }, { status: 403 });
  }
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false, code: "forbidden" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.isActive || user.role !== "PARTICIPANT") {
    return NextResponse.json({ ok: false, code: "forbidden" }, { status: 403 });
  }
  const form = await request.formData();
  const file = form.get("file");
  const submissionId = String(form.get("submissionId") ?? "");
  const kind = String(form.get("kind") ?? "") as FileKind;
  if (!(file instanceof File) || !kinds.has(kind)) {
    return NextResponse.json({ ok: false, code: "invalid_input" }, { status: 400 });
  }
  const owned = await prisma.submission.findFirst({
    where: { id: submissionId, project: { team: { OR: [{ leaderId: user.id }, { members: { some: { userId: user.id } } }] } } },
    select: { status: true },
  });
  if (!owned || owned.status !== "DRAFT") {
    return NextResponse.json({ ok: false, code: "upload_with_update" }, { status: 400 });
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const result = await storeSubmissionFile({
    userId: user.id,
    role: "PARTICIPANT",
    submissionId,
    kind,
    name: file.name,
    mime: file.type || "application/octet-stream",
    bytes,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
