import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { GET } from "./route"
import { createUser, setUserActive } from "@/lib/users/repository"
import { freshDb, setTestDb, type Queryable } from "@/lib/test-support/db"

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

const callback = () => GET(new NextRequest("http://localhost/api/auth/callback/google?code=abc"))

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
})
