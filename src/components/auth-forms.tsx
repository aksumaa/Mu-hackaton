"use client";

import { Eye, EyeOff } from "lucide-react";
import { useActionState, useState, type ChangeEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { changePasswordAction, loginAction, registerAction, requestResetAction, resetWithTokenAction } from "@/server/auth-actions";
import { FormMessage } from "@/components/messages";
import { Button, Field, SelectInput, TextInput } from "@/components/ui";

function PasswordField({
  id,
  name,
  label,
  autoComplete,
  hint,
  error,
  strength,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  hint?: string;
  error?: string;
  strength?: boolean;
}) {
  const t = useTranslations("auth");
  const [shown, setShown] = useState(false);
  const [value, setValue] = useState("");
  const mixed = /[A-Za-z]/.test(value) && /\d/.test(value);
  const hintText = !strength ? hint : value.length < 8 ? t("strengthWeak") : value.length >= 12 && mixed ? t("strengthStrong") : t("strengthOk");
  return (
    <Field id={id} label={label} hint={hintText} error={error}>
      <div className="flex min-w-0 gap-2">
        <TextInput
          id={id}
          name={name}
          type={shown ? "text" : "password"}
          autoComplete={autoComplete}
          required
          minLength={name === "password" || name === "nextPassword" ? 8 : undefined}
          aria-describedby={hintText ? `${id}-hint` : undefined}
          aria-invalid={error ? true : undefined}
          value={strength ? value : undefined}
          onChange={strength ? (event) => setValue(event.target.value) : undefined}
        />
        <button
          type="button"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border"
          aria-pressed={shown}
          aria-label={shown ? t("hide") : t("show")}
          onClick={() => setShown((current) => !current)}
        >
          {shown ? <EyeOff aria-hidden size={18} /> : <Eye aria-hidden size={18} />}
        </button>
      </div>
    </Field>
  );
}

export function LoginForm({ locale, next = "" }: { locale: string; next?: string }) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(loginAction, null);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={next} />
      <FormMessage state={state} />
      <Field id="studentId" label={t("id")} hint={t("staffHint")} error={state?.field === "studentId" ? undefined : undefined}>
        <TextInput id="studentId" name="studentId" autoComplete="username" required minLength={4} />
      </Field>
      <PasswordField id="password" name="password" label={t("password")} autoComplete="current-password" />
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "…" : t("loginTitle")}
      </Button>
      <p className="text-sm">
        {t("noAccount")} <Link href="/register" className="font-semibold underline">{t("create")}</Link>
      </p>
    </form>
  );
}

export function RegisterForm({
  locale,
  faculties,
}: {
  locale: string;
  faculties: { id: string; name: string }[];
}) {
  const t = useTranslations("auth");
  const common = useTranslations("common");
  const errors = useTranslations("errors");
  const [state, action, pending] = useActionState(registerAction, null);
  const [form, setForm] = useState({
    fullName: "",
    studentId: "",
    facultyId: faculties[0]?.id ?? "",
    course: "1",
    groupName: "",
    phone: "",
    telegram: "",
    email: "",
    acceptRules: false,
  });
  const problem = (name: string) => (state?.field === name && state.error ? errors(state.error as "generic") : undefined);
  const set = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="locale" value={locale} />
      <FormMessage state={state} />
      <Field id="fullName" label={t("fullName")} error={problem("fullName")}>
        <TextInput id="fullName" name="fullName" autoComplete="name" required minLength={3} maxLength={120} value={form.fullName} onChange={set} aria-invalid={problem("fullName") ? true : undefined} />
      </Field>
      <Field id="studentId" label={t("id")} hint={t("idHint")} error={problem("studentId")}>
        <TextInput
          id="studentId"
          name="studentId"
          autoComplete="username"
          required
          minLength={4}
          maxLength={40}
          pattern={"[A-Za-z0-9\\- ]{4,40}"}
          title={t("idHint")}
          spellCheck={false}
          value={form.studentId}
          onChange={set}
          aria-invalid={problem("studentId") ? true : undefined}
        />
      </Field>
      <Field id="facultyId" label={t("faculty")} error={problem("facultyId")}>
        <SelectInput id="facultyId" name="facultyId" required value={form.facultyId} onChange={set} aria-invalid={problem("facultyId") ? true : undefined}>
          {faculties.map((faculty) => (
            <option key={faculty.id} value={faculty.id}>
              {faculty.name}
            </option>
          ))}
        </SelectInput>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="course" label={t("course")} error={problem("course")}>
          <SelectInput id="course" name="course" required value={form.course} onChange={set} aria-invalid={problem("course") ? true : undefined}>
            {[1, 2, 3, 4, 5, 6].map((course) => (
              <option key={course} value={course}>
                {course}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id="groupName" label={t("group")} hint={t("groupHint")} error={problem("groupName")}>
          <TextInput id="groupName" name="groupName" required minLength={2} maxLength={32} value={form.groupName} onChange={set} aria-invalid={problem("groupName") ? true : undefined} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="phone" label={`${t("phone")} · ${common("optional")}`} error={problem("phone")}>
          <TextInput id="phone" name="phone" autoComplete="tel" inputMode="tel" maxLength={64} value={form.phone} onChange={set} aria-invalid={problem("phone") ? true : undefined} />
        </Field>
        <Field id="telegram" label={`${t("telegram")} · ${common("optional")}`} error={problem("telegram")}>
          <TextInput id="telegram" name="telegram" autoComplete="off" maxLength={64} value={form.telegram} onChange={set} aria-invalid={problem("telegram") ? true : undefined} />
        </Field>
      </div>
      <Field id="email" label={`${t("email")} · ${common("optional")}`} error={problem("email")}>
        <TextInput id="email" name="email" type="email" autoComplete="email" maxLength={160} value={form.email} onChange={set} aria-invalid={problem("email") ? true : undefined} />
      </Field>
      <PasswordField id="password" name="password" label={t("password")} autoComplete="new-password" strength error={problem("password")} />
      <div className="grid gap-1.5">
        <label className="flex items-start gap-3 text-sm leading-6">
          <input
            id="acceptRules"
            name="acceptRules"
            type="checkbox"
            required
            checked={form.acceptRules}
            onChange={(event) => setForm((current) => ({ ...current, acceptRules: event.target.checked }))}
            aria-invalid={problem("acceptRules") ? true : undefined}
            className="mt-1 h-5 w-5"
          />
          <span>
            {t("accept")}{" "}
            <Link href="/regulation" className="font-semibold underline">
              {t("rulesLink")}
            </Link>
          </span>
        </label>
        {problem("acceptRules") ? <p role="alert" className="text-sm font-medium text-danger">{problem("acceptRules")}</p> : null}
      </div>
      <Button type="submit" disabled={pending || faculties.length === 0} aria-busy={pending}>
        {pending ? common("submitting") : t("create")}
      </Button>
      <p className="text-sm">
        {t("haveAccount")} <Link href="/login" className="font-semibold underline">{t("loginTitle")}</Link>
      </p>
    </form>
  );
}

export function ForgotForm() {
  const t = useTranslations("auth");
  const common = useTranslations("common");
  const locale = useLocale();
  const [state, action, pending] = useActionState(requestResetAction, null);
  return (
    <form action={action} className="grid max-w-lg gap-4">
      <input type="hidden" name="locale" value={locale} />
      <FormMessage state={state} />
      <Field id="studentId" label={t("id")}>
        <TextInput id="studentId" name="studentId" autoComplete="username" required />
      </Field>
      <Button type="submit" disabled={pending}>{pending ? common("loading") : t("sendReset")}</Button>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const t = useTranslations("auth");
  const common = useTranslations("common");
  const locale = useLocale();
  const [state, action, pending] = useActionState(resetWithTokenAction, null);
  return (
    <form action={action} className="grid max-w-lg gap-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      <PasswordField id="nextPassword" name="nextPassword" label={t("next")} autoComplete="new-password" strength />
      <PasswordField id="confirmPassword" name="confirmPassword" label={t("confirmPassword")} autoComplete="new-password" />
      <Button type="submit" disabled={pending || token.length < 10}>{pending ? common("saving") : common("save")}</Button>
    </form>
  );
}

export function ChangePasswordForm({ locale }: { locale: string }) {
  const t = useTranslations("auth");
  const common = useTranslations("common");
  const [state, action, pending] = useActionState(changePasswordAction, null);
  return (
    <form action={action} className="grid max-w-lg gap-4">
      <input type="hidden" name="locale" value={locale} />
      <FormMessage state={state} />
      <PasswordField id="currentPassword" name="currentPassword" label={t("current")} autoComplete="current-password" />
      <PasswordField id="nextPassword" name="nextPassword" label={t("next")} autoComplete="new-password" strength />
      <PasswordField id="confirmPassword" name="confirmPassword" label={t("confirmPassword")} autoComplete="new-password" />
      <Button type="submit" disabled={pending}>
        {pending ? common("saving") : common("save")}
      </Button>
    </form>
  );
}
