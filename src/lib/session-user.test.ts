import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { resolveSessionUser } from "./session-user"
import { createUser, assignRole, setUserActive, deleteUser } from "./users/repository"
import { freshDb, setTestDb, sessionFor, type Queryable } from "./test-support/db"

describe("resolveSessionUser (#75)", () => {
  let db: Queryable
  let userId: number
  const token = () => sessionFor("u@kmitl.ac.th")

  beforeEach(async () => {
    db = freshDb()
    setTestDb(db)
    userId = (await createUser(db, { email: "u@kmitl.ac.th", name: "U" })).id
    await assignRole(db, userId, "Student")
  })

  afterEach(() => setTestDb(null))

  it("returns the active user with roles", async () => {
    const user = await resolveSessionUser(token())
    expect(user?.id).toBe(userId)
    expect(user?.roles).toEqual(["Student"])
  })

  it("returns null for a missing or forged token", async () => {
    expect(await resolveSessionUser(undefined)).toBeNull()
    expect(await resolveSessionUser("garbage.token")).toBeNull()
  })

  it("returns null once the account is deactivated — the open session dies", async () => {
    const t = token()
    await setUserActive(db, userId, false)
    expect(await resolveSessionUser(t)).toBeNull()
  })

  it("returns null once the account is deleted", async () => {
    const t = token()
    await deleteUser(db, userId)
    expect(await resolveSessionUser(t)).toBeNull()
  })
})
