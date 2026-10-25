import { getTranslations, setRequestLocale } from "next-intl/server";
import { ActionForm } from "@/components/action-form";
import { Badge, Button, Card, Empty, Field, SelectInput, TableWrap, TextArea, TextInput } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { createStaff, resetPassword, reviewMember, setActive, setOverride } from "@/server/admin-actions";

export default async function UsersPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string }> }) {
  const { locale } = await params;
  const { q = "" } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations();
  const users = await prisma.user.findMany({
    where: q ? { OR: [{ fullName: { contains: q, mode: "insensitive" } }, { studentId: { contains: q, mode: "insensitive" } }, { ledTeam: { name: { contains: q, mode: "insensitive" } } }] } : {},
    include: { ledTeam: { include: { members: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const pending = await prisma.teamMember.findMany({
    where: { verificationStatus: { in: ["PENDING", "REJECTED"] } },
    include: { team: true, faculty: true },
    take: 100,
  });
  return (
    <div className="grid gap-6">
      <form method="get" className="flex flex-col gap-2 sm:flex-row">
        <input name="q" defaultValue={q} aria-label={t("admin.searchUsers")} placeholder={t("admin.searchUsers")} className="min-h-11 w-full rounded-xl border border-border bg-card px-3" />
        <Button type="submit">{t("common.search")}</Button>
      </form>
      <Card>
        <h2 className="font-semibold">{t("admin.createUser")}</h2>
        <ActionForm action={createStaff} locale={locale} className="mt-3 grid gap-3">
          <Field id="staff-name" label={t("admin.fullName")}><TextInput id="staff-name" name="fullName" required minLength={3} /></Field>
          <Field id="staff-id" label={t("admin.staffId")}><TextInput id="staff-id" name="studentId" required minLength={4} /></Field>
          <Field id="staff-role" label={t("admin.role")}>
            <SelectInput id="staff-role" name="role" defaultValue="JUDGE">
              <option value="JUDGE">{t("admin.judge")}</option>
              <option value="ADMIN">{t("admin.adminRole")}</option>
            </SelectInput>
          </Field>
          <Button type="submit">{t("common.add")}</Button>
        </ActionForm>
      </Card>
      {users.length === 0 ? <Empty>{t("admin.noRows")}</Empty> : (
        <TableWrap>
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead><tr><th className="p-2">{t("admin.fullName")}</th><th className="p-2">ID</th><th className="p-2">{t("admin.role")}</th><th className="p-2">{t("common.status")}</th><th className="p-2">{t("common.actions")}</th></tr></thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-border align-top">
                  <td className="break-words p-2">{user.fullName}</td>
                  <td className="p-2">{user.studentId}</td>
                  <td className="p-2">{user.role}</td>
                  <td className="p-2"><Badge tone={user.isActive ? "good" : "bad"}>{user.isActive ? t("admin.active") : t("admin.deactivate")}</Badge></td>
                  <td className="grid gap-2 p-2">
                    <ActionForm action={resetPassword} locale={locale}><input type="hidden" name="userId" value={user.id} /><Button type="submit" variant="secondary">{t("admin.resetPassword")}</Button></ActionForm>
                    <ActionForm action={setActive} locale={locale}>
                      <input type="hidden" name="userId" value={user.id} />
                      <input type="hidden" name="active" value={user.isActive ? "false" : "true"} />
                      <Button type="submit" variant="secondary">{user.isActive ? t("admin.deactivate") : t("admin.activate")}</Button>
                    </ActionForm>
                    {user.ledTeam ? (
                      <form action={setOverride}>
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="teamId" value={user.ledTeam.id} />
                        <input type="hidden" name="override" value={user.ledTeam.eligibilityOverride ? "false" : "true"} />
                        <Button type="submit" variant="ghost">{user.ledTeam.eligibilityOverride ? t("admin.clearOverride") : t("admin.override")}</Button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
      <section className="grid gap-3">
        <h2 className="text-xl font-semibold">{t("admin.pendingVerifications")}</h2>
        {pending.length === 0 ? <Empty>{t("common.none")}</Empty> : pending.map((member) => (
          <Card key={member.id}>
            <p className="break-words font-semibold">{member.fullName} · {member.studentId}</p>
            <p className="text-sm text-muted">{member.faculty.nameEn} · {member.groupName}</p>
            <ActionForm action={reviewMember} locale={locale} className="mt-3 grid gap-2">
              <input type="hidden" name="memberId" value={member.id} />
              <Field id={`note-${member.id}`} label={t("admin.note")}><TextArea id={`note-${member.id}`} name="note" /></Field>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" name="decision" value="VERIFIED">{t("admin.verify")}</Button>
                <Button type="submit" name="decision" value="REJECTED" variant="danger">{t("admin.reject")}</Button>
              </div>
            </ActionForm>
          </Card>
        ))}
      </section>
    </div>
  );
}
