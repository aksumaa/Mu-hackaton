"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { FormMessage } from "@/components/messages";
import { Button, Field, SelectInput, TextInput } from "@/components/ui";
import { generateReadablePassword } from "@/lib/password";
import { removeMember, resetMemberPassword } from "@/server/participant-actions";
import type { ActionState } from "@/server/action-state";

function ShareAccess({ locale, access }: { locale: string; access: { fullName: string; studentId: string; password: string }[] }) {
  const t = useTranslations("cabinet");
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return;
    }
  }
  return (
    <div className="mt-4 grid gap-3 rounded-2xl border border-border bg-accent-soft p-4">
      <h3 className="font-semibold">{t("shareTitle")}</h3>
      <p className="text-sm">{t("shareOnce")}</p>
      {access.map((item) => (
        <div key={item.studentId} className="grid gap-2 text-sm">
          <p className="font-semibold">{item.fullName}</p>
          <p className="break-all">{t("loginLabel")}: {item.studentId}</p>
          <p className="break-all">{t("memberPassword")}: {item.password}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => copy(`${t("loginLabel")}: ${item.studentId}\n${t("memberPassword")}: ${item.password}`)}>{t("copy")}</Button>
            <Button type="button" variant="secondary" onClick={() => copy(t("telegramShare", { site: `${window.location.origin}/${locale}/login`, login: item.studentId, password: item.password }))}>{t("copyTelegram")}</Button>
          </div>
        </div>
      ))}
    </div>
  );
}

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
  const cabinet = useTranslations("cabinet");
  const [state, formAction, pending] = useActionState(action, null);
  const [password, setPassword] = useState("");
  return (
    <form action={formAction} className="mt-4 grid gap-3">
      <input type="hidden" name="locale" value={locale} />
      <FormMessage state={state} />
      {state?.access?.length ? <ShareAccess locale={locale} access={state.access} /> : null}
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
      <Field id="member-password" label={cabinet("memberPassword")}>
        <div className="flex min-w-0 gap-2">
          <TextInput id="member-password" name="password" required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <Button type="button" variant="secondary" onClick={() => setPassword(generateReadablePassword())}>{cabinet("generate")}</Button>
        </div>
      </Field>
      <Button type="submit" disabled={pending}>{pending ? t("common.saving") : t("common.add")}</Button>
    </form>
  );
}

export function MemberControls({ locale, memberId, open }: { locale: string; memberId: string; open: boolean }) {
  const t = useTranslations();
  const cabinet = useTranslations("cabinet");
  const [password, setPassword] = useState("");
  const [resetState, resetAction, resetPending] = useActionState(resetMemberPassword, null);
  const [removeState, removeAction, removePending] = useActionState(removeMember, null);
  return (
    <div className="mt-3 grid gap-3">
      <FormMessage state={resetState?.access ? { ...resetState, access: undefined } : resetState} />
      {resetState?.access?.length ? <ShareAccess locale={locale} access={resetState.access} /> : null}
      <form action={resetAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="memberId" value={memberId} />
        <Field id={`reset-${memberId}`} label={cabinet("memberPassword")}>
          <TextInput id={`reset-${memberId}`} name="password" required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </Field>
        <Button type="button" variant="secondary" onClick={() => setPassword(generateReadablePassword())}>{cabinet("generate")}</Button>
        <Button type="submit" variant="secondary" disabled={resetPending}>{resetPending ? t("common.saving") : cabinet("resetPassword")}</Button>
      </form>
      {open ? (
        <form action={removeAction}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="memberId" value={memberId} />
          <FormMessage state={removeState} />
          <Button type="submit" variant="secondary" disabled={removePending}>{t("common.remove")}</Button>
        </form>
      ) : null}
    </div>
  );
}
