"use client";

import { useTranslations } from "next-intl";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations();
  return (
    <article className="mx-auto max-w-lg py-10">
      <h1 className="text-3xl font-semibold">{t("errors.generic")}</h1>
      <button type="button" onClick={reset} className="mt-6 inline-flex min-h-11 items-center rounded-full bg-accent px-4 font-semibold text-accent-foreground">
        {t("common.retry")}
      </button>
    </article>
  );
}
