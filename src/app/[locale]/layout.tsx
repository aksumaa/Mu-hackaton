import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { HeaderBar, LocaleLinks } from "@/components/chrome";
import { Logo } from "@/components/logo";
import { Providers } from "@/components/providers";
import { Link } from "@/i18n/navigation";
import { CONTACTS, SOCIALS } from "@/config/university";
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

const display = Source_Serif_4({
  subsets: ["latin", "latin-ext", "cyrillic"],
  variable: "--font-source-serif",
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
    <html lang={locale} className={`${inter.variable} ${display.variable}`} suppressHydrationWarning>
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
          <footer className="mt-4 border-t border-border">
            <div className="h-1 bg-gradient-to-r from-brand-800 via-brand to-brand-200" />
            <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_0.8fr_1fr]">
              <div>
                <Link href="/" className="inline-flex items-center gap-3">
                  <Logo className="h-12" />
                  <span className="font-display text-xl font-semibold">MU Hackathon</span>
                </Link>
                <p className="mt-3 max-w-sm text-sm leading-6 text-muted">{t("footer.note")}</p>
              </div>
              <div className="grid content-start gap-1 text-sm">
                <Link href="/regulation" className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">{t("nav.rules")}</Link>
                <Link href="/timeline" className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">{t("nav.timeline")}</Link>
                <Link href="/criteria" className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">{t("nav.criteria")}</Link>
                <Link href="/faq" className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">{t("nav.faq")}</Link>
              </div>
              <div className="grid content-start gap-1 text-sm">
                {CONTACTS.address ? <p className="mb-2 leading-6">{CONTACTS.address}</p> : null}
                {CONTACTS.phone ? <a className="inline-flex min-h-11 items-center underline-offset-4 hover:underline" href={`tel:${CONTACTS.phone.replace(/\s/g, "")}`}>{CONTACTS.phone}</a> : null}
                {CONTACTS.email ? <a className="inline-flex min-h-11 items-center underline-offset-4 hover:underline" href={`mailto:${CONTACTS.email}`}>{CONTACTS.email}</a> : null}
                {SOCIALS.website ? <a className="inline-flex min-h-11 items-center underline-offset-4 hover:underline" href={SOCIALS.website}>{t("footer.website")}</a> : null}
                {SOCIALS.telegram ? <a className="inline-flex min-h-11 items-center underline-offset-4 hover:underline" href={SOCIALS.telegram}>{t("footer.telegram")}</a> : null}
                {SOCIALS.instagram ? <a className="inline-flex min-h-11 items-center underline-offset-4 hover:underline" href={SOCIALS.instagram}>{t("footer.instagram")}</a> : null}
                <Link href="/contacts" className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">{t("nav.contact")}</Link>
                <LocaleLinks locale={locale} />
                <p className="mt-2 text-muted">{t("footer.rights")}</p>
              </div>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
