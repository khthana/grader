import { describe, it, expect } from "vitest"
import { hashPassword, verifyPassword } from "./password"

describe("password hashing", () => {
  it("verifies a correct password against its hash", async () => {
    const hash = await hashPassword("Password123!")
    expect(await verifyPassword("Password123!", hash)).toBe(true)
  })

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("Password123!")
    expect(await verifyPassword("wrong-password", hash)).toBe(false)
  })

  it("produces a salted, non-deterministic hash", async () => {
    const a = await hashPassword("Password123!")
    const b = await hashPassword("Password123!")
    expect(a).not.toBe(b)
    // both still verify against the original password
    expect(await verifyPassword("Password123!", a)).toBe(true)
    expect(await verifyPassword("Password123!", b)).toBe(true)
  })
})
