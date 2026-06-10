import { describe, it, expect, vi } from "vitest"
import { createSessionToken, verifySessionToken } from "./auth"

describe("session token", () => {
  it("round-trips the payload it was created with", () => {
    const token = createSessionToken({
      email: "admin@kmitl.ac.th",
      name: "System Admin",
      picture: "https://example.com/a.png",
    })

    const payload = verifySessionToken(token)

    expect(payload).not.toBeNull()
    expect(payload?.email).toBe("admin@kmitl.ac.th")
    expect(payload?.name).toBe("System Admin")
    expect(payload?.picture).toBe("https://example.com/a.png")
    expect(payload?.exp).toBeGreaterThan(Date.now())
  })

  it("rejects a token whose signature was tampered with", () => {
    const token = createSessionToken({ email: "a@b.co", name: "A" })
    const [data] = token.split(".")
    const forged = `${data}.${"x".repeat(43)}`

    expect(verifySessionToken(forged)).toBeNull()
  })

  it("rejects a token whose payload was swapped under the original signature", () => {
    const token = createSessionToken({ email: "a@b.co", name: "A" })
    const signature = token.split(".")[1]
    const evilData = Buffer.from(
      JSON.stringify({ email: "evil@b.co", name: "Evil", exp: Date.now() + 1000 })
    )
      .toString("base64url")

    expect(verifySessionToken(`${evilData}.${signature}`)).toBeNull()
  })

  it("rejects malformed tokens", () => {
    expect(verifySessionToken("")).toBeNull()
    expect(verifySessionToken("no-dot")).toBeNull()
    expect(verifySessionToken("only.")).toBeNull()
    expect(verifySessionToken(".onlysig")).toBeNull()
  })

  it("rejects a correctly-signed token once it has expired", () => {
    vi.useFakeTimers()
    try {
      const token = createSessionToken({ email: "a@b.co", name: "A" })
      expect(verifySessionToken(token)).not.toBeNull()

      // advance just past the 8h session lifetime
      vi.advanceTimersByTime(8 * 60 * 60 * 1000 + 1)
      expect(verifySessionToken(token)).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})
