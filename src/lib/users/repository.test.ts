import { describe, it, expect, beforeEach } from "vitest"
import {
  createUser,
  findUserByEmail,
  getUserWithRoles,
  updateProfile,
  assignRole,
} from "./repository"
import { freshDb, type Queryable } from "@/lib/test-support/db"

describe("user repository", () => {
  let db: Queryable

  beforeEach(() => {
    db = freshDb()
  })

  it("creates a user and reads it back by email", async () => {
    const created = await createUser(db, {
      email: "admin@kmitl.ac.th",
      passwordHash: "hashed",
      name: "System Admin",
    })

    expect(created.id).toBeGreaterThan(0)
    expect(created.email).toBe("admin@kmitl.ac.th")

    const found = await findUserByEmail(db, "admin@kmitl.ac.th")
    expect(found).not.toBeNull()
    expect(found?.id).toBe(created.id)
    expect(found?.passwordHash).toBe("hashed")
    expect(found?.name).toBe("System Admin")
    expect(found?.isActive).toBe(true)
  })

  it("returns null when reading an unknown email", async () => {
    expect(await findUserByEmail(db, "nobody@kmitl.ac.th")).toBeNull()
  })

  it("matches email case-insensitively on read", async () => {
    await createUser(db, { email: "Admin@KMITL.ac.th", name: "A", passwordHash: "h" })
    const found = await findUserByEmail(db, "admin@kmitl.ac.th")
    expect(found).not.toBeNull()
  })

  it("enforces email uniqueness", async () => {
    await createUser(db, { email: "dup@kmitl.ac.th", name: "One", passwordHash: "h" })
    await expect(
      createUser(db, { email: "dup@kmitl.ac.th", name: "Two", passwordHash: "h" })
    ).rejects.toThrow()
  })

  it("reads a user with their assigned role names", async () => {
    const u = await createUser(db, { email: "a@kmitl.ac.th", name: "A", passwordHash: "h" })
    await assignRole(db, u.id, "Admin")
    await assignRole(db, u.id, "Instructor")

    const withRoles = await getUserWithRoles(db, u.id)
    expect(withRoles).not.toBeNull()
    expect(withRoles?.email).toBe("a@kmitl.ac.th")
    expect([...(withRoles?.roles ?? [])].sort()).toEqual(["Admin", "Instructor"])
  })

  it("returns an empty role list for a user with no roles", async () => {
    const u = await createUser(db, { email: "b@kmitl.ac.th", name: "B", passwordHash: "h" })
    const withRoles = await getUserWithRoles(db, u.id)
    expect(withRoles?.roles).toEqual([])
  })

  it("getUserWithRoles returns nickname as null when not set", async () => {
    const u = await createUser(db, { email: "c@kmitl.ac.th", name: "C", passwordHash: "h" })
    const withRoles = await getUserWithRoles(db, u.id)
    expect(withRoles?.nickname).toBeNull()
  })

  it("updateProfile stores nickname and getUserWithRoles returns it", async () => {
    const u = await createUser(db, { email: "d@kmitl.ac.th", name: "D", passwordHash: "h" })
    await updateProfile(db, u.id, { nickname: "น้องมิ้ว" })
    const withRoles = await getUserWithRoles(db, u.id)
    expect(withRoles?.nickname).toBe("น้องมิ้ว")
  })

  it("updateProfile clears nickname when passed null", async () => {
    const u = await createUser(db, { email: "e@kmitl.ac.th", name: "E", passwordHash: "h" })
    await updateProfile(db, u.id, { nickname: "temporary" })
    await updateProfile(db, u.id, { nickname: null })
    const withRoles = await getUserWithRoles(db, u.id)
    expect(withRoles?.nickname).toBeNull()
  })
})
