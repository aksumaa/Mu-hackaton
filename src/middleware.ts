import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

const handleI18n = createMiddleware(routing);
const locales = routing.locales;
const protectedRoots = ["/cabinet", "/judge", "/admin", "/change-password"];

function hasSession(request: NextRequest) {
  return request.cookies.getAll().some((cookie) => {
    const name = cookie.name;
    return name === "authjs.session-token"
      || name.startsWith("authjs.session-token.")
      || name === "__Secure-authjs.session-token"
      || name.startsWith("__Secure-authjs.session-token.");
  });
}

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const locale = locales.find((item) => pathname === `/${item}` || pathname.startsWith(`/${item}/`));
  if (locale) {
    const rest = pathname.slice(locale.length + 1) || "/";
    const guarded = protectedRoots.some((root) => rest === root || rest.startsWith(`${root}/`));
    if (guarded && !hasSession(request)) {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/login`;
      url.search = "";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }
  return handleI18n(request);
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
