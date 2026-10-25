import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";
import { readObject } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return new Response(null, { status: 404 });
  const row = await prisma.appSetting.findUnique({ where: { key: "prdTemplate" } });
  const value = row?.value;
  if (!value || typeof value !== "object" || Array.isArray(value) || !("storageKey" in value)) return new Response(null, { status: 404 });
  const storageKey = String(value.storageKey);
  const bytes = await readObject(storageKey);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=\"prd-template.pdf\"",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
