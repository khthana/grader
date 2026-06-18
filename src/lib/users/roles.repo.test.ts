import { describe, it, expect, beforeEach } from "vitest"
import {
  createUser,
  assignRole,
  setUserRoles,
  countUsersWithRole,
  getUserById,
} from "./repository"
import { freshDb, type Queryable } from "@/lib/test-support/db"

async function rolesOf(db: Queryable, id: number): Promise<string[]> {
  return [...((await getUserById(db, id))?.roles ?? [])].sort()
}

describe("setUserRoles", () => {
  let db: Queryable
  beforeEach(() => {
    db = freshDb()
  })

  it("assigns a fresh set to a user who had none", async () => {
    const u = await createUser(db, { email: "a@kmitl.ac.th", name: "A", idCode: "1" })
    await setUserRoles(db, u.id, ["Instructor", "TA"])
    expect(await rolesOf(db, u.id)).toEqual(["Instructor", "TA"])
  })

  it("revokes removed roles and adds new ones", async () => {
    const u = await createUser(db, { email: "b@kmitl.ac.th", name: "B", idCode: "2" })
    await assignRole(db, u.id, "Admin")
    await assignRole(db, u.id, "Student")

    await setUserRoles(db, u.id, ["Student", "TA"])
    expect(await rolesOf(db, u.id)).toEqual(["Student", "TA"])
  })

  it("clears all roles when given an empty set", async () => {
    const u = await createUser(db, { email: "c@kmitl.ac.th", name: "C", idCode: "3" })
    await assignRole(db, u.id, "Admin")
    await setUserRoles(db, u.id, [])
    expect(await rolesOf(db, u.id)).toEqual([])
  })

  it("is idempotent and does not create duplicates", async () => {
    const u = await createUser(db, { email: "d@kmitl.ac.th", name: "D", idCode: "4" })
    await setUserRoles(db, u.id, ["Student"])
    await setUserRoles(db, u.id, ["Student"])
    expect(await rolesOf(db, u.id)).toEqual(["Student"])
  })
})

describe("countUsersWithRole", () => {
  let db: Queryable
  beforeEach(() => {
    db = freshDb()
  })

  it("counts distinct users holding a given role", async () => {
    const a = await createUser(db, { email: "a@kmitl.ac.th", name: "A", idCode: "1" })
    const b = await createUser(db, { email: "b@kmitl.ac.th", name: "B", idCode: "2" })
    await assignRole(db, a.id, "Admin")
    await assignRole(db, b.id, "Admin")
    await assignRole(db, b.id, "Student")

    expect(await countUsersWithRole(db, "Admin")).toBe(2)
    expect(await countUsersWithRole(db, "Student")).toBe(1)
    expect(await countUsersWithRole(db, "TA")).toBe(0)
  })
})
