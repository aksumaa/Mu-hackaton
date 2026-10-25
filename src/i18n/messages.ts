import { en } from "@/i18n/en";
import { ru } from "@/i18n/ru";
import { uz } from "@/i18n/uz";
import type { Locale } from "@/i18n/routing";

export const messages: Record<Locale, typeof en> = { uz, ru, en };
