import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { GET } from "./route"
import { OAUTH_STATE_COOKIE } from "@/lib/oauth-state"

describe("GET /api/auth/google", () => {
  beforeEach(() => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "id")
    vi.stubEnv("NEXTAUTH_URL", "http://localhost:3000")
  })
  afterEach(() => vi.unstubAllEnvs())

  const start = () => GET()

  it("sends a random state to Google and pins it in a short-lived httpOnly cookie (#76)", async () => {
    const res = await start()
    const location = new URL(res.headers.get("location")!)
    expect(location.host).toBe("accounts.google.com")
    const state = location.searchParams.get("state")
    expect(state).toMatch(/^[\w-]{32,}$/)

    const cookie = res.cookies.get(OAUTH_STATE_COOKIE)
    expect(cookie?.value).toBe(state)
    expect(cookie?.httpOnly).toBe(true)
    expect(cookie?.sameSite).toBe("lax")
    expect(cookie?.path).toBe("/api/auth/callback/google")
    expect(cookie?.maxAge).toBeLessThanOrEqual(600)
  })

  it("uses a fresh state on every attempt", async () => {
    const a = new URL((await start()).headers.get("location")!).searchParams.get("state")
    const b = new URL((await start()).headers.get("location")!).searchParams.get("state")
    expect(a).not.toBe(b)
  })

  it("returns 503 when Google OAuth is not configured", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "")
    expect((await start()).status).toBe(503)
  })
})
