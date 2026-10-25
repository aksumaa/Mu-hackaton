export function tr(locale: string, uz: string, ru: string, en: string) {
  if (locale === "ru") return ru;
  if (locale === "en") return en;
  return uz;
}

export function homeFor(role: "PARTICIPANT" | "JUDGE" | "ADMIN") {
  if (role === "ADMIN") return "/admin";
  if (role === "JUDGE") return "/judge";
  return "/cabinet";
}
