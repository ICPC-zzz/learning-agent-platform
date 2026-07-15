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

  const publicOrigin = resolvePublicOrigin(request);
  if (!publicOrigin) {
    return new NextResponse("服务配置暂不可用。", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const loginUrl = new URL("/auth/login", publicOrigin);
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

function resolvePublicOrigin(request: NextRequest): string | null {
  const configuredBaseUrl = process.env.APP_BASE_URL?.trim();
  if (configuredBaseUrl) {
    try {
      const url = new URL(configuredBaseUrl);
      const allowedProtocol = url.protocol === "https:"
        || (process.env.NODE_ENV !== "production" && url.protocol === "http:");
      if (allowedProtocol && !url.username && !url.password && !isLocalHostname(url.hostname)) {
        return url.origin;
      }
    } catch {
      // Fall back to the request origin when the deployment setting is invalid.
    }
  }

  return process.env.NODE_ENV === "production" ? null : request.nextUrl.origin;
}

function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
  return normalized === "localhost"
    || normalized.endsWith(".localhost")
    || normalized === "127.0.0.1"
    || normalized === "::1";
}
