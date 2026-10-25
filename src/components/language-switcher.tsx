"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export function LanguageSwitcher() {
  const t = useTranslations("lang");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="sr-only">{t("label")}</span>
      <select
        aria-label={t("label")}
        className="h-10 rounded-full border border-border bg-card px-3"
        value={locale}
        onChange={(event) => router.replace(pathname, { locale: event.target.value })}
      >
        {routing.locales.map((item) => (
          <option key={item} value={item}>{t(item)}</option>
        ))}
      </select>
    </label>
  );
}
