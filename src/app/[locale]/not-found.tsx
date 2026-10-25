import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("common");
  return (
    <article className="mx-auto max-w-lg py-10">
      <h1 className="text-3xl font-semibold">{t("empty")}</h1>
      <Link href="/" className="mt-6 inline-flex min-h-11 items-center font-semibold underline">{t("back")}</Link>
    </article>
  );
}
