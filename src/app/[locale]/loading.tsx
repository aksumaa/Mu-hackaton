import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/logo";

export default async function Loading() {
  const t = await getTranslations("common");
  return (
    <div role="status" className="flex min-h-[60vh] flex-col items-center justify-center gap-5">
      <Logo className="h-20" />
      <p className="text-sm font-medium text-muted">{t("loading")}</p>
    </div>
  );
}
