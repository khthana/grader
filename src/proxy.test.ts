import { describe, it, expect } from "vitest"
import { NextRequest } from "next/server"
import { proxy } from "./proxy"
import { createSessionToken } from "@/lib/auth"

function request(path: string, sessionToken?: string): NextRequest {
  const req = new NextRequest(`http://localhost${path}`)
  if (sessionToken) req.cookies.set("session", sessionToken)
  return req
}

const validSession = () =>
  createSessionToken({ email: "admin@kmitl.ac.th", name: "System Admin" })

describe("proxy (route protection)", () => {
  it("redirects an unauthenticated request for a protected route to /login", () => {
    const res = proxy(request("/dashboard"))
    expect(res.status).toBe(307)
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login")
  })

  it("redirects an authenticated user away from /login", () => {
    const res = proxy(request("/login", validSession()))
    expect(res.status).toBe(307)
    expect(new URL(res.headers.get("location")!).pathname).not.toBe("/login")
  })

  it("lets an authenticated request through to a protected route", () => {
    const res = proxy(request("/dashboard", validSession()))
    expect(res.headers.get("location")).toBeNull()
  })

  it("lets an unauthenticated request reach /login", () => {
    const res = proxy(request("/login"))
    expect(res.headers.get("location")).toBeNull()
  })

  it("treats a tampered session cookie as unauthenticated on a protected route", () => {
    const res = proxy(request("/dashboard", "garbage.token"))
    expect(res.status).toBe(307)
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login")
  })
})
