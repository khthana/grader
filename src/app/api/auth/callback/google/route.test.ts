import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { NextRequest, NextResponse } from "next/server"
import { GET } from "./route"
import { createUser, setUserActive } from "@/lib/users/repository"
import { freshDb, setTestDb, type Queryable } from "@/lib/test-support/db"
import { OAUTH_STATE_COOKIE } from "@/lib/oauth-state"

// Google's token + userinfo endpoints are external — stub fetch with a fixed
// profile so the test exercises only our account checks.
function stubGoogle(email: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.includes("/token")
        ? Response.json({ access_token: "at", id_token: "it", token_type: "Bearer", expires_in: 3600 })
        : Response.json({ sub: "1", email, name: "G", picture: "" })
    )
  )
}

// A callback as Google sends it: `state` echoed in the query, and the cookie
// the start route set. Either side may be overridden (or dropped with null).
function callback(opts: { query?: string | null; cookie?: string | null } = {}) {
  const query = opts.query === undefined ? "s1" : opts.query
  const cookie = opts.cookie === undefined ? "s1" : opts.cookie
  const url = `http://localhost/api/auth/callback/google?code=abc${query === null ? "" : `&state=${query}`}`
  const req = new NextRequest(url)
  if (cookie !== null) req.cookies.set(OAUTH_STATE_COOKIE, cookie)
  return GET(req)
}

const loginError = (res: Response) => new URL(res.headers.get("location")!).searchParams.get("error")

describe("GET /api/auth/callback/google", () => {
  let db: Queryable

  beforeEach(async () => {
    db = freshDb()
    setTestDb(db)
    vi.stubEnv("GOOGLE_CLIENT_ID", "id")
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "secret")
    vi.stubEnv("NEXTAUTH_URL", "http://localhost:3000")
  })

  afterEach(() => {
    setTestDb(null)
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it("signs in an active registered user", async () => {
    await createUser(db, { email: "g@kmitl.ac.th", name: "G" })
    stubGoogle("g@kmitl.ac.th")
    const res = await callback()
    expect(res.cookies.get("session")?.value).toBeTruthy()
  })

  it("refuses a deactivated account: no cookie, back to /login?error=inactive (#75)", async () => {
    const u = await createUser(db, { email: "g@kmitl.ac.th", name: "G" })
    await setUserActive(db, u.id, false)
    stubGoogle("g@kmitl.ac.th")
    const res = await callback()
    expect(res.cookies.get("session")).toBeUndefined()
    const location = new URL(res.headers.get("location")!)
    expect(location.pathname).toBe("/login")
    expect(location.searchParams.get("error")).toBe("inactive")
  })

  describe("state check — login CSRF (#76)", () => {
    beforeEach(async () => {
      await createUser(db, { email: "g@kmitl.ac.th", name: "G" })
      stubGoogle("g@kmitl.ac.th")
    })

    const expectRejected = async (res: NextResponse) => {
      expect(res.cookies.get("session")).toBeUndefined()
      expect(loginError(res)).toBe("invalid_state")
      // Rejected before the code is ever exchanged with Google.
      expect(fetch).not.toHaveBeenCalled()
    }

    it("rejects a callback with no state in the query", async () => {
      await expectRejected(await callback({ query: null }))
    })

    it("rejects a callback with no state cookie (flow not started in this browser)", async () => {
      await expectRejected(await callback({ cookie: null }))
    })

    it("rejects a mismatching state", async () => {
      await expectRejected(await callback({ query: "attacker", cookie: "s1" }))
    })

    it("clears the state cookie so it can't be replayed", async () => {
      // Same path as when set, or the browser keeps the original cookie.
      const cleared = (res: NextResponse) => {
        const c = res.cookies.get(OAUTH_STATE_COOKIE)
        expect(c?.value).toBe("")
        expect(c?.maxAge).toBe(0)
        expect(c?.path).toBe("/api/auth/callback/google")
      }
      cleared(await callback())
      cleared(await callback({ query: "x" }))
    })
  })
})
