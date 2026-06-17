import { describe, it, expect } from "vitest"
import { NextRequest } from "next/server"
import { POST } from "./route"
import { createSessionToken, verifySessionToken } from "@/lib/auth"

function req(cookies: Record<string, string>): NextRequest {
  const r = new NextRequest("http://localhost/api/users/impersonate/exit", { method: "POST" })
  for (const [k, v] of Object.entries(cookies)) r.cookies.set(k, v)
  return r
}

describe("POST /api/users/impersonate/exit", () => {
  it("restores the admin session from the impersonator cookie and clears impersonation state", async () => {
    const adminToken = createSessionToken({ email: "admin@kmitl.ac.th", name: "Admin" })
    const targetToken = createSessionToken({ email: "stu@kmitl.ac.th", name: "Stu" })

    const res = await POST(
      req({ session: targetToken, impersonator: adminToken, active_role: "Student", active_course: "3" })
    )
    expect(res.status).toBe(200)

    const session = res.cookies.get("session")?.value ?? ""
    expect(verifySessionToken(session)?.email).toBe("admin@kmitl.ac.th")

    // impersonator and active_* are cleared (deleted cookies carry an empty value)
    expect(res.cookies.get("impersonator")?.value).toBe("")
    expect(res.cookies.get("active_role")?.value).toBe("")
    expect(res.cookies.get("active_course")?.value).toBe("")
  })

  it("is a safe no-op when not impersonating (no impersonator cookie)", async () => {
    const targetToken = createSessionToken({ email: "stu@kmitl.ac.th", name: "Stu" })
    const res = await POST(req({ session: targetToken }))

    expect(res.status).toBe(200)
    // session is left untouched when there is nothing to restore
    expect(res.cookies.get("session")).toBeUndefined()
  })
})
