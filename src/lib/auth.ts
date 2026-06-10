import { createHmac, timingSafeEqual } from "crypto"

export interface SessionPayload {
  email: string
  name: string
  picture?: string
  exp: number
}

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000 // 8 hours
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
