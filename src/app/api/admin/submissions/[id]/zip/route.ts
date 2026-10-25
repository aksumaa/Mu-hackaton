import JSZip from "jszip";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";
import { readObject } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user || user.role !== "ADMIN") return new Response(null, { status: 404 });
  const { id } = await context.params;
  const submission = await prisma.submission.findUnique({ where: { id }, include: { files: { where: { isCurrent: true } } } });
  if (!submission) return new Response(null, { status: 404 });
  const zip = new JSZip();
  for (const file of submission.files) {
    const bytes = await readObject(file.storageKey);
    zip.file(file.originalName.replace(/[/\\]/g, "_"), bytes);
  }
  const packed = await zip.generateAsync({ type: "nodebuffer" });
  return new Response(new Uint8Array(packed), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${id}.zip"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
