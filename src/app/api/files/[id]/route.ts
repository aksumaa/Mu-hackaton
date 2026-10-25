import { canAccessStoredFile } from "@/lib/files-access";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";
import { readObject, verifyLocalSignature } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const url = new URL(request.url);
  if (!verifyLocalSignature(id, url.searchParams.get("exp") ?? "", url.searchParams.get("sig") ?? "")) {
    return new Response(null, { status: 404 });
  }
  const user = await currentUser();
  const file = await prisma.submissionFile.findUnique({
    where: { id },
    include: { submission: { include: { project: { include: { team: true } } } } },
  });
  if (!file) return new Response(null, { status: 404 });
  const allowed = canAccessStoredFile({
    actor: user ? { id: user.id, role: user.role, isActive: user.isActive } : null,
    ownerId: file.submission.project.team.leaderId,
    submissionStatus: file.submission.status,
  });
  if (!allowed) return new Response(null, { status: 404 });
  const bytes = await readObject(file.storageKey);
  const mime = file.mime === "text/html" || file.mime === "image/svg+xml" ? "application/octet-stream" : file.mime;
  const filename = file.originalName.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 120) || "file";
  const inline = mime === "application/pdf" || mime === "video/mp4";
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
