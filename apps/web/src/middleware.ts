import { NextRequest, NextResponse } from "next/server";

const WEB_SESSION_COOKIE_NAME = "lap_session";
const PROTECTED_PREFIXES = [
  "/user",
  "/ai",
  "/learning",
  "/agent",
  "/admin",
];

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (!PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"))) {
    return NextResponse.next();
  }

  const hasSessionCookie = Boolean(request.cookies.get(WEB_SESSION_COOKIE_NAME)?.value);
  if (hasSessionCookie) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/auth/login", request.url);
  loginUrl.searchParams.set("returnTo", safeReturnTo(pathname));
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/user/:path*", "/ai/:path*", "/learning/:path*", "/agent/:path*", "/admin/:path*"],
};

function safeReturnTo(pathname: string): string {
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return "/";
  return pathname;
}
