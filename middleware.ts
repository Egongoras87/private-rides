import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(
  request: NextRequest
) {

  const url =
    request.nextUrl.clone();

  const host =
    request.headers.get(
      "host"
    ) || "";

  // ---------------------------------------------------
  // DOMINIOS
  // ---------------------------------------------------

  const driverDomain =
    "driver.privaterideslasvegas.com";

  // ---------------------------------------------------
  // DRIVER SUBDOMAIN
  // ---------------------------------------------------

  if (
    host === driverDomain
  ) {

    // 🔥 ROOT DRIVER
    if (
      url.pathname === "/"
    ) {

      url.pathname =
        "/login-driver";

      return NextResponse.redirect(
        url
      );
    }

    // ---------------------------------------------------
    // BLOQUEAR RUTAS USER
    // ---------------------------------------------------

    const blockedRoutes = [

      "/login-user",

      "/tracking",

      "/terms",

      "/privacy"
    ];

    if (
      blockedRoutes.includes(
        url.pathname
      )
    ) {

      url.pathname =
        "/driver";

      return NextResponse.redirect(
        url
      );
    }
  }

  return NextResponse.next();
}

// ---------------------------------------------------
// MATCHER
// ---------------------------------------------------

export const config = {

  matcher: [

    "/((?!api|_next/static|_next/image|favicon.ico).*)"
  ]
};