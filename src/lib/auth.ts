import { createHmac, timingSafeEqual } from "crypto"

export interface SessionPayload {
  email: string
  name: string
  picture?: string
  exp: number
}

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000 // 8 hours

// Cookie options for the `session` cookie (and the `impersonator` cookie that
// holds a saved Admin session). One copy, so every issuer agrees on scope and
// lifetime; logout reuses it with maxAge 0.
// Where a page sends a request whose signed cookie no longer maps to an active
// account (deactivated or deleted — #75). The proxy lets this through despite
// the cookie (a bare /login would bounce back to the app and loop) and clears
// the dead cookie. Every server-side "not signed in" redirect must use it.
export const SESSION_ENDED_ERROR = "session_ended"
export const SESSION_ENDED_PATH = `/login?error=${SESSION_ENDED_ERROR}`

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_DURATION_MS / 1000,
}
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-session-secret"

function toBase64Url(value: string) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}

function fromBase64Url(value: string) {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4)
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
}

function sign(value: string) {
  return toBase64Url(createHmac("sha256", SESSION_SECRET).update(value).digest("base64"))
}

export function createSessionToken(payload: {
  email: string
  name: string
  picture?: string
}) {
  const session: SessionPayload = {
    ...payload,
    exp: Date.now() + SESSION_DURATION_MS,
  }
  const data = toBase64Url(JSON.stringify(session))
  const signature = sign(data)
  return `${data}.${signature}`
}

export function verifySessionToken(token: string): SessionPayload | null {
  const [data, signature] = token.split('.')
  if (!data || !signature) return null

  const expected = sign(data)

  try {
    const signatureBuf = Buffer.from(signature)
    const expectedBuf = Buffer.from(expected)
    if (signatureBuf.length !== expectedBuf.length || !timingSafeEqual(signatureBuf, expectedBuf)) {
      return null
    }
  } catch {
    return null
  }

  try {
    const payload = JSON.parse(fromBase64Url(data)) as SessionPayload
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) {
      return null
    }
    return payload
  } catch {
    return null
  }
}
