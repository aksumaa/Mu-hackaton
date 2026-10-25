"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const t = useTranslations("theme");
  const { theme, setTheme } = useTheme();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const dark = ready && theme === "dark";
  return (
    <button
      type="button"
      className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-3 text-sm"
      aria-label={t("toggle")}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
      <span>{dark ? t("light") : t("dark")}</span>
    </button>
  );
}
