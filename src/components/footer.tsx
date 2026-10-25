import { useTranslations } from "next-intl";
import { Logo } from "@/components/logo";

export function Footer() {
  const t = useTranslations("footer");
  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-3 text-foreground">
          <Logo className="h-10" />
          <span className="font-semibold">{t("university")}</span>
        </p>
        <p>{t("note")}</p>
      </div>
    </footer>
  );
}
