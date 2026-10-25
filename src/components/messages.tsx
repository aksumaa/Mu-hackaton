"use client";

import { useTranslations } from "next-intl";

export function FormMessage({ state }: { state: { ok?: boolean; error?: string; notice?: string; password?: string; imported?: number; skipped?: string[] } | null }) {
  const errors = useTranslations("errors");
  const common = useTranslations("common");
  const admin = useTranslations("admin");
  if (!state) return null;
  return (
    <div className="grid gap-2">
      {state.ok && !state.error ? <p role="status" className="text-sm font-semibold">{common("saved")}</p> : null}
      {state.error ? (
        <p role="alert" className="rounded-2xl bg-rose-100 px-3 py-2 text-sm font-medium text-rose-950 dark:bg-rose-950 dark:text-rose-100">
          {errors.has(state.error as "generic") ? errors(state.error as "generic") : errors("generic")} {common("retry")}
        </p>
      ) : null}
      {state.notice ? (
        <p role="status" className="rounded-2xl bg-amber-100 px-3 py-2 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100">
          {errors.has(state.notice as "generic") ? errors(state.notice as "generic") : state.notice}
        </p>
      ) : null}
      {state.password ? (
        <p role="status" className="break-all rounded-2xl bg-accent-soft px-3 py-2 text-sm">
          <span className="font-semibold">{admin("tempPassword")}: </span>
          {state.password}
          <span className="mt-1 block text-muted">{admin("passwordOnce")}</span>
        </p>
      ) : null}
      {typeof state.imported === "number" ? (
        <p role="status" className="text-sm">
          {admin("imported")}: {state.imported}. {admin("rowErrors")}: {state.skipped?.join(", ") || common("none")}
        </p>
      ) : null}
    </div>
  );
}
