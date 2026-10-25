"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export function ErrorNote({ code, onRetry }: { code: string | null; onRetry?: () => void }) {
  const t = useTranslations("errors");
  const common = useTranslations("common");
  if (!code) return null;
  const message = t.has(code) ? t(code) : code;
  return (
    <div className="rounded-2xl border border-danger/40 bg-card px-4 py-3 text-sm" role="alert">
      <p>{message}</p>
      {onRetry ? <button type="button" className="mt-2 underline" onClick={onRetry}>{common("retry")}</button> : null}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export const controlClass = "w-full rounded-xl border border-border bg-card px-3 py-2 text-base";

export function PasswordField({ label, value, onChange, autoComplete }: { label: string; value: string; onChange: (value: string) => void; autoComplete: string }) {
  const t = useTranslations("common");
  const [shown, setShown] = useState(false);
  return (
    <Field label={label} hint={t("passwordHint")}>
      <span className="flex gap-2">
        <input className={controlClass} type={shown ? "text" : "password"} autoComplete={autoComplete} value={value} onChange={(event) => onChange(event.target.value)} required minLength={8} />
        <button type="button" className="rounded-xl border border-border px-3" onClick={() => setShown((item) => !item)}>{shown ? t("hidePassword") : t("showPassword")}</button>
      </span>
    </Field>
  );
}
