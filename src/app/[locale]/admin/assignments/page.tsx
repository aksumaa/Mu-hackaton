import { getTranslations, setRequestLocale } from "next-intl/server";
import { ActionForm } from "@/components/action-form";
import { Button, Card, Empty, Field, SelectInput, TableWrap } from "@/components/ui";
import { pickActiveStage } from "@/lib/deadlines";
import { prisma } from "@/lib/prisma";
import { autoAssign, manualAssign } from "@/server/admin-actions";

export default async function AssignmentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const stage = pickActiveStage(await prisma.stage.findMany());
  const judges = await prisma.user.findMany({ where: { role: "JUDGE", isActive: true }, orderBy: { fullName: "asc" } });
  const submissions = stage
    ? await prisma.submission.findMany({
        where: { stageKey: stage.key, status: { not: "DRAFT" } },
        include: { project: true, assignments: { include: { judge: true } } },
        orderBy: { firstSubmittedAt: "asc" },
      })
    : [];
  return (
    <div className="grid gap-4">
      {stage ? (
        <form action={autoAssign}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="key" value={stage.key} />
          <Button type="submit">{t("admin.autoAssign")}</Button>
        </form>
      ) : <Empty>{t("common.empty")}</Empty>}
      <Card>
        <h2 className="font-semibold">{t("admin.manualAssign")}</h2>
        <ActionForm action={manualAssign} locale={locale} className="mt-3 grid gap-3">
          <Field id="judgeId" label={t("admin.judge")}>
            <SelectInput id="judgeId" name="judgeId" defaultValue={judges[0]?.id ?? ""}>
              {judges.map((judge) => <option key={judge.id} value={judge.id}>{judge.fullName}</option>)}
            </SelectInput>
          </Field>
          <Field id="submissionId" label={t("admin.submission")}>
            <SelectInput id="submissionId" name="submissionId" defaultValue={submissions[0]?.id ?? ""}>
              {submissions.map((submission) => <option key={submission.id} value={submission.id}>{submission.project.title || submission.id}</option>)}
            </SelectInput>
          </Field>
          <Button type="submit" disabled={judges.length === 0 || submissions.length === 0}>{t("admin.assign")}</Button>
        </ActionForm>
      </Card>
      <h2 className="font-semibold">{t("admin.matrix")}</h2>
      {submissions.length === 0 ? <Empty>{t("admin.noRows")}</Empty> : (
        <TableWrap>
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead><tr><th className="p-2">{t("admin.submission")}</th>{judges.map((judge) => <th key={judge.id} className="p-2">{judge.fullName}</th>)}</tr></thead>
            <tbody>
              {submissions.map((submission) => (
                <tr key={submission.id} className="border-t border-border">
                  <td className="max-w-[12rem] break-words p-2">{submission.project.title || submission.id}</td>
                  {judges.map((judge) => {
                    const assignment = submission.assignments.find((item) => item.judgeId === judge.id);
                    return <td key={judge.id} className="p-2">{assignment ? (assignment.conflictDeclared ? t("admin.conflict") : assignment.status) : "—"}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </div>
  );
}
