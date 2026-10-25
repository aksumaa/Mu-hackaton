export type ActionState = {
  ok?: boolean;
  error?: string;
  field?: string;
  notice?: string;
  password?: string;
  imported?: number;
  skipped?: string[];
} | null;

export function text(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

export function checked(form: FormData, key: string) {
  const value = form.get(key);
  return value === "on" || value === "true" || value === "1";
}

export function rethrowRedirect(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
  ) {
    throw error;
  }
}

export function localeOf(form: FormData) {
  const locale = text(form, "locale");
  return locale === "ru" || locale === "en" ? locale : "uz";
}
