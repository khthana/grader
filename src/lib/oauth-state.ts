import { randomBytes, timingSafeEqual } from "crypto"
import { SECURE_COOKIE_BASE } from "./auth"

// OAuth `state` for the Google sign-in flow (#76, CWE-352). The start route
// sends a random value to Google and pins it in this cookie; the callback only
// accepts a `state` that matches it. Without this an attacker could finish a
// login flow for *their* account in a victim's browser (login CSRF).
export const OAUTH_STATE_COOKIE = "oauth_state"

export const OAUTH_STATE_COOKIE_OPTIONS = {
  // sameSite lax (from the base) still sends it on Google's top-level GET
  // redirect back to us; the path keeps it off every other request.
  ...SECURE_COOKIE_BASE,
  path: "/api/auth/callback/google",
  maxAge: 10 * 60, // one sign-in attempt
}

export function createOAuthState(): string {
  return randomBytes(32).toString("base64url")
}

export function oauthStateMatches(
  expected: string | undefined,
  received: string | null
): boolean {
  if (!expected || !received) return false
  const a = Buffer.from(expected)
  const b = Buffer.from(received)
  return a.length === b.length && timingSafeEqual(a, b)
}
