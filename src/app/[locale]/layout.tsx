import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { HeaderBar } from "@/components/chrome";
import { Logo } from "@/components/logo";
import { Providers } from "@/components/providers";
import { Link } from "@/i18n/navigation";
import { isLocale, routing, type Locale } from "@/i18n/routing";
import { homeFor } from "@/lib/locale-text";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";
import { signOutAction } from "@/server/auth-actions";
import "../globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  const title = t("title");
  const description = t("description");
  return {
    metadataBase: new URL(process.env.AUTH_URL || "http://localhost:3000"),
    title: { default: title, template: `%s · ${title}` },
    description,
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "any" },
        { url: "/icon.png", type: "image/png", sizes: "32x32" },
      ],
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    },
    openGraph: {
      title,
      description,
      images: [{ url: "/og.png", width: 1200, height: 630, alt: title }],
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  await connection();
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations();
  const messages = await getMessages();
  const user = await currentUser().catch(() => null);
  const unread = user ? await prisma.notification.count({ where: { userId: user.id, readAt: null } }).catch(() => 0) : 0;
  const items = [
    { href: "/regulation", label: t("nav.rules") },
    { href: "/timeline", label: t("nav.timeline") },
    { href: "/tracks", label: t("nav.tracks") },
    { href: "/criteria", label: t("nav.criteria") },
    { href: "/prizes", label: t("nav.prizes") },
    { href: "/faq", label: t("nav.faq") },
    { href: "/contacts", label: t("nav.contact") },
  ];
  if (!user) items.push({ href: "/login", label: t("nav.login") });
  const accountHref = user ? homeFor(user.role) : "/register";
  const accountLabel = user
    ? `${user.role === "ADMIN" ? t("nav.admin") : user.role === "JUDGE" ? t("nav.judge") : t("nav.cabinet")}${unread ? ` (${unread})` : ""}`
    : t("nav.register");

  return (
    <html lang={locale} className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <Providers locale={locale} messages={messages}>
          <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-foreground">
            {t("common.skip")}
          </a>
          <HeaderBar
            locale={locale as Locale}
            items={items}
            accountHref={accountHref}
            accountLabel={accountLabel}
            authed={Boolean(user)}
            signOut={signOutAction}
          />
          <main id="main" className="mx-auto w-full min-w-0 max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
            {children}
          </main>
          <footer className="border-t border-border">
            <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
              <div>
                <Link href="/" className="inline-flex items-center gap-3">
                  <Logo className="h-12" />
                  <span className="text-lg font-semibold">MU Hackathon</span>
                </Link>
                <p className="mt-3 max-w-sm text-sm leading-6 text-muted">{t("footer.note")}</p>
              </div>
              <div className="grid gap-2 text-sm">
                <Link href="/regulation" className="underline-offset-4 hover:underline">{t("nav.rules")}</Link>
                <Link href="/timeline" className="underline-offset-4 hover:underline">{t("nav.timeline")}</Link>
                <Link href="/criteria" className="underline-offset-4 hover:underline">{t("nav.criteria")}</Link>
              </div>
              <div className="grid content-start gap-2 text-sm">
                <Link href="/contacts" className="underline-offset-4 hover:underline">{t("nav.contact")}</Link>
                <Link href="/faq" className="underline-offset-4 hover:underline">{t("nav.faq")}</Link>
                <p className="text-muted">{t("footer.rights")}</p>
              </div>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
