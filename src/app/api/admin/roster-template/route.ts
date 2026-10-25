import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user || user.role !== "ADMIN") return new Response(null, { status: 404 });
  const body = "studentId,fullName,faculty,group\nMU-0001,Full Name,School of IT,IT-23-01\n";
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"roster-template.csv\"",
      "Cache-Control": "private, no-store",
    },
  });
}
