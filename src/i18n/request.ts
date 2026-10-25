import { getRequestConfig } from "next-intl/server";
import { messages } from "@/i18n/messages";
import { isLocale, routing } from "@/i18n/routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = requested && isLocale(requested) ? requested : routing.defaultLocale;
  return {
    locale,
    messages: messages[locale],
    timeZone: "Asia/Tashkent",
  };
});
