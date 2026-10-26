"use client";

import { Menu, Moon, Sun, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { Link, usePathname } from "@/i18n/navigation";
import { countdownParts } from "@/lib/countdown";
import { cn } from "@/lib/utils";

export function HeaderBar({
  locale,
  items,
  accountHref,
  accountLabel,
  authed,
  signOut,
}: {
  locale: string;
  items: { href: string; label: string }[];
  accountHref: string | null;
  accountLabel: string | null;
  authed: boolean;
  signOut: () => Promise<void>;
}) {
  const t = useTranslations();
  const path = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const locales = [
    { code: "uz", label: "UZ" },
    { code: "ru", label: "RU" },
    { code: "en", label: "EN" },
  ] as const;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-2 px-4 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2.5 font-semibold">
          <Logo className="h-10" />
          <span className="sr-only">MU Hackathon</span>
          <span className="hidden min-w-0 leading-tight md:block" aria-hidden="true">
            MU Hackathon
            <span className="block text-xs font-medium text-muted">Millat Umidi</span>
          </span>
        </Link>
        <nav className="ml-4 hidden items-center gap-1 xl:flex" aria-label="Main">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={path === item.href ? "page" : undefined}
              className={cn(
                "rounded-full px-2.5 py-2 text-sm",
                path === item.href ? "bg-accent-soft font-semibold text-foreground shadow-[inset_0_-2px_0_0_var(--meter)]" : "text-muted",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <div className="hidden rounded-full border border-border p-0.5 sm:flex" role="group" aria-label={t("common.language")}>
            {locales.map((item) => (
              <Link
                key={item.code}
                href={path || "/"}
                locale={item.code}
                hrefLang={item.code}
                aria-current={locale === item.code ? "page" : undefined}
                className={cn(
                  "grid h-11 w-11 place-items-center rounded-full text-xs font-bold",
                  locale === item.code ? "bg-accent text-accent-foreground" : "text-muted",
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-full border border-border"
            aria-label={mounted && resolvedTheme === "dark" ? t("common.themeLight") : t("common.themeDark")}
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          >
            {mounted && resolvedTheme === "dark" ? <Sun aria-hidden size={18} /> : <Moon aria-hidden size={18} />}
          </button>
          {accountHref && accountLabel ? (
            <Link href={accountHref} className="hidden rounded-full bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground sm:inline-flex">
              {accountLabel}
            </Link>
          ) : null}
          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-full border border-border xl:hidden"
            aria-expanded={open}
            aria-controls="site-menu"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X aria-hidden size={18} /> : <Menu aria-hidden size={18} />}
            <span className="sr-only">{open ? t("common.close") : t("common.menu")}</span>
          </button>
        </div>
      </div>
      {open ? (
        <div id="site-menu" className="border-t border-border bg-card xl:hidden">
          <div className="mx-auto grid max-w-6xl gap-1 px-4 py-3 sm:px-6">
            <div className="px-1 pb-2 sm:hidden">
              <LocaleLinks locale={locale} />
            </div>
            <nav className="grid gap-1" aria-label="Main">
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex min-h-12 items-center rounded-xl px-3 text-base font-medium",
                    path === item.href && "bg-accent-soft font-semibold shadow-[inset_3px_0_0_0_var(--meter)]",
                  )}
                  aria-current={path === item.href ? "page" : undefined}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            {accountHref && accountLabel ? (
              <Link href={accountHref} onClick={() => setOpen(false)} className="mt-1 inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-4 font-semibold text-accent-foreground">
                {accountLabel}
              </Link>
            ) : null}
            {authed ? (
              <form action={signOut}>
                <button type="submit" className="flex min-h-12 w-full items-center rounded-xl px-3 text-left font-semibold">
                  {t("common.signOut")}
                </button>
              </form>
            ) : null}
          </div>
        </div>
      ) : null}
    </header>
  );
}

export function SectionNav({ label, items }: { label: string; items: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav className="flex w-full min-w-0 max-w-full gap-2 overflow-x-auto pb-1" aria-label={label}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={path === item.href ? "page" : undefined}
          className={cn(
            "shrink-0 rounded-full border border-border px-3 py-2 text-sm font-semibold",
            path === item.href ? "bg-accent text-accent-foreground" : "bg-card",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function LocaleLinks({ locale }: { locale: string }) {
  const path = usePathname();
  const t = useTranslations();
  const locales = [
    { code: "uz", label: "UZ" },
    { code: "ru", label: "RU" },
    { code: "en", label: "EN" },
  ] as const;
  return (
    <div className="flex gap-1" role="group" aria-label={t("common.language")}>
      {locales.map((item) => (
        <Link
          key={item.code}
          href={path || "/"}
          locale={item.code}
          hrefLang={item.code}
          aria-current={locale === item.code ? "page" : undefined}
          className={cn(
            "grid h-11 w-11 place-items-center rounded-full text-xs font-bold",
            locale === item.code ? "bg-accent text-accent-foreground" : "border border-border text-muted",
          )}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}

export function Countdown({ iso, label, plain = false }: { iso: string; label: string; plain?: boolean }) {
  const t = useTranslations("hero");
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const parts = now === null ? null : countdownParts(new Date(iso), new Date(now));
  const cells = [
    [parts?.days ?? 0, t("days")],
    [parts?.hours ?? 0, t("hours")],
    [parts?.minutes ?? 0, t("minutes")],
    [parts?.seconds ?? 0, t("seconds")],
  ] as const;
  return (
    <div className={plain ? "min-w-0" : "min-w-0 rounded-[1.5rem] border border-border bg-background/85 p-4 backdrop-blur-sm sm:p-5"}>
      <p className={plain ? "text-xs font-bold uppercase tracking-[0.18em] text-muted" : "text-sm font-semibold text-muted"}>{label}</p>
      {plain ? null : <p className="mt-1 text-sm">{parts?.done ? t("countdownDone") : t("countdown")}</p>}
      <div className={plain ? "mt-3 grid grid-cols-4 gap-3 border-t border-foreground pt-3" : "mt-4 grid grid-cols-4 gap-2"}>
        {cells.map(([value, caption]) => (
          <div key={caption} className={plain ? "min-w-0" : "min-w-0 rounded-2xl bg-accent-soft px-1 py-3 text-center"}>
            <div className={plain ? "font-display text-3xl font-semibold tabular-nums leading-none sm:text-5xl" : "font-display text-3xl font-semibold tabular-nums leading-none sm:text-4xl"} suppressHydrationWarning>
              {parts ? String(value).padStart(2, "0") : "--"}
            </div>
            <div className="mt-2 break-words text-[11px] font-medium uppercase tracking-wide text-muted">{caption}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
