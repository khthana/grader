import { NextRequest, NextResponse } from "next/server"
import { verifySessionToken } from "@/lib/auth"

// Next 16 proxy (formerly middleware) — runs on the Node.js runtime, so the
// HMAC session verification (node:crypto) works here.

const LOGIN_PATH = "/login"
const LANDING_PATH = "/dashboard"

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const token = req.cookies.get("session")?.value
  const session = token ? verifySessionToken(token) : null

  if (pathname === LOGIN_PATH) {
    // Already signed in? Don't show the login page again.
    if (session) return NextResponse.redirect(new URL(LANDING_PATH, req.url))
    return NextResponse.next()
  }

  // Every other matched path is protected.
  if (!session) {
    return NextResponse.redirect(new URL(LOGIN_PATH, req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/login",
    "/dashboard/:path*",
    "/users/:path*",
    "/logs/:path*",
    "/courses/:path*",
    "/students/:path*",
    "/problems/:path*",
    "/review/:path*",
    "/gradebook/:path*",
    "/assignments/:path*",
    "/scorebook/:path*",
  ],
}
