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
  // DRIVER DOMAIN
  // ---------------------------------------------------

  const driverDomain =
    "driver.privaterideslasvegas.com";

  // ---------------------------------------------------
  // DRIVER SUBDOMAIN
  // ---------------------------------------------------

  if (
    host.includes(driverDomain)
  ) {

    // abrir root driver
    if (
      url.pathname === "/"
    ) {

      url.pathname =
        "/login-driver";

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