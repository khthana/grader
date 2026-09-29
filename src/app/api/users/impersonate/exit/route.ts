import { NextRequest, NextResponse } from "next/server"
import { SESSION_COOKIE_OPTIONS, verifySessionToken } from "@/lib/auth"

// Stop impersonating: move the saved `impersonator` token back into `session`,
// drop the `impersonator` cookie, and clear active_role / active_course so the
// restored Admin resolves to their own defaults. Driven entirely by the
// `impersonator` cookie (the impersonated session itself may be a non-Admin),
// and a safe no-op when no valid impersonator token is present.
export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true })

  const impersonator = request.cookies.get("impersonator")?.value
  if (impersonator && verifySessionToken(impersonator)) {
    response.cookies.set("session", impersonator, SESSION_COOKIE_OPTIONS)
    response.cookies.delete("impersonator")
    response.cookies.delete("active_role")
    response.cookies.delete("active_course")
  }

  return response
}
