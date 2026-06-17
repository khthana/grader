import { describe, it, expect } from "vitest"
import { canImpersonate } from "./impersonation"

const base = {
  actorRoles: ["Admin"],
  actorId: 1,
  targetId: 2,
  isProduction: false,
}

describe("canImpersonate", () => {
  it("allows an Admin in development to impersonate another user", () => {
    expect(canImpersonate(base)).toEqual({ ok: true })
  })

  it("refuses in production", () => {
    expect(canImpersonate({ ...base, isProduction: true })).toEqual({
      ok: false,
      reason: "production",
    })
  })

  it("refuses a non-Admin actor", () => {
    expect(canImpersonate({ ...base, actorRoles: ["Instructor", "TA"] })).toEqual({
      ok: false,
      reason: "not-admin",
    })
  })

  it("refuses impersonating yourself", () => {
    expect(canImpersonate({ ...base, targetId: base.actorId })).toEqual({
      ok: false,
      reason: "self",
    })
  })
})
