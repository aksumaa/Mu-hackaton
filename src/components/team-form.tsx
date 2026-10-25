"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { FormMessage } from "@/components/messages";
import { Button, Field, SelectInput, TextInput } from "@/components/ui";
import type { ActionState } from "@/server/action-state";

export function TeamForm({
  locale,
  faculties,
  action,
}: {
  locale: string;
  faculties: { id: string; name: string }[];
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="mt-4 grid gap-3">
      <input type="hidden" name="locale" value={locale} />
      <FormMessage state={state} />
      <Field id="member-name" label={t("auth.fullName")}><TextInput id="member-name" name="fullName" required minLength={3} /></Field>
      <Field id="member-id" label={t("auth.id")}><TextInput id="member-id" name="studentId" required minLength={4} /></Field>
      <Field id="member-faculty" label={t("auth.faculty")}>
        <SelectInput id="member-faculty" name="facultyId" defaultValue={faculties[0]?.id}>
          {faculties.map((faculty) => <option key={faculty.id} value={faculty.id}>{faculty.name}</option>)}
        </SelectInput>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="member-course" label={t("auth.course")}>
          <SelectInput id="member-course" name="course" defaultValue="1">{[1, 2, 3, 4, 5, 6].map((course) => <option key={course}>{course}</option>)}</SelectInput>
        </Field>
        <Field id="member-group" label={t("auth.group")} hint={t("auth.groupHint")}><TextInput id="member-group" name="groupName" required minLength={2} /></Field>
      </div>
      <Button type="submit" disabled={pending}>{pending ? t("common.saving") : t("common.add")}</Button>
    </form>
  );
}
