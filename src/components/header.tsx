"use client";

import { Menu, X } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/logo";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { logoutAction } from "@/app/actions";

const links = ["regulation", "timeline", "tracks", "criteria", "prizes", "faq", "contacts"] as const;

export function Header({ role, unread }: { role?: string | null; unread: number }) {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const area = role === "ADMIN" ? "/admin" : role === "JUDGE" ? "/judge" : role === "PARTICIPANT" ? "/cabinet" : null;
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Logo className="h-9" />
          <span>MU Hackathon</span>
        </Link>
        <nav className="hidden items-center gap-4 text-sm lg:flex" aria-label={t("primary")}>
          {links.map((item) => <Link key={item} href={`/${item}`}>{t(item)}</Link>)}
        </nav>
        <div className="ml-auto hidden items-center gap-2 lg:flex">
          <LanguageSwitcher />
          <ThemeToggle />
          {area ? (
            <>
              <Link className="rounded-full bg-accent px-4 py-2 text-sm text-accent-foreground" href={area}>{t(role === "ADMIN" ? "admin" : role === "JUDGE" ? "judge" : "cabinet")}</Link>
              {role === "PARTICIPANT" ? <Link href="/cabinet/notifications" className="text-sm">{t("notifications")} {unread > 0 ? `(${unread})` : ""}</Link> : null}
              <form action={logoutAction}><button className="text-sm underline" type="submit">{t("logout")}</button></form>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm">{t("login")}</Link>
              <Link href="/register" className="rounded-full bg-accent px-4 py-2 text-sm text-accent-foreground">{t("register")}</Link>
            </>
          )}
        </div>
        <button type="button" className="ml-auto rounded-full border border-border p-2 lg:hidden" aria-expanded={open} aria-label={t("menu")} onClick={() => setOpen((value) => !value)}>
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>
      {open ? (
        <div className="grid gap-3 border-t border-border px-4 py-4 lg:hidden">
          {links.map((item) => <Link key={item} href={`/${item}`} onClick={() => setOpen(false)}>{t(item)}</Link>)}
          <LanguageSwitcher />
          <ThemeToggle />
          {area ? <Link href={area}>{t(role === "ADMIN" ? "admin" : role === "JUDGE" ? "judge" : "cabinet")}</Link> : <Link href="/register">{t("register")}</Link>}
        </div>
      ) : null}
    </header>
  );
}
