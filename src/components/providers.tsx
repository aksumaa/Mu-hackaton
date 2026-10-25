"use client";

import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider, useTheme } from "next-themes";
import { Toaster } from "sonner";
import type { ReactNode } from "react";

function ToastHost() {
  const { resolvedTheme } = useTheme();
  return <Toaster theme={resolvedTheme === "dark" ? "dark" : "light"} position="top-center" />;
}

export function Providers({
  locale,
  messages,
  children,
}: {
  locale: string;
  messages: Record<string, unknown>;
  children: ReactNode;
}) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="mu-theme">
      <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Tashkent">
        {children}
        <ToastHost />
      </NextIntlClientProvider>
    </ThemeProvider>
  );
}
