import { describe, it, expect, beforeEach } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { newDb } from "pg-mem"
import { createUser, assignRole, listUsers, type Queryable } from "./repository"

const schema = readFileSync(
  fileURLToPath(new URL("../../../schema.sql", import.meta.url)),
  "utf8"
)

function freshDb(): Queryable {
  const mem = newDb()
  mem.public.none(schema)
  const { Pool } = mem.adapters.createPg()
  return new Pool() as unknown as Queryable
}

describe("listUsers", () => {
  let db: Queryable

  beforeEach(async () => {
    db = freshDb()
  })

  it("returns all users with their roles and a total count", async () => {
    const admin = await createUser(db, { email: "admin@kmitl.ac.th", name: "System Admin" })
    await assignRole(db, admin.id, "Admin")
    await createUser(db, { email: "stu@kmitl.ac.th", name: "Student One" })

    const { users, total } = await listUsers(db, { search: "", page: 1, pageSize: 10 })

    expect(total).toBe(2)
    expect(users).toHaveLength(2)
    const first = users[0]
    expect(first.email).toBe("admin@kmitl.ac.th")
    expect(first.name).toBe("System Admin")
    expect(first.roles).toEqual(["Admin"])
    expect(first.isActive).toBe(true)
    // user with no roles gets an empty list, not null
    expect(users[1].roles).toEqual([])
  })

  it("matches search against name, email, or ID code (case-insensitive)", async () => {
    await createUser(db, { email: "alice@kmitl.ac.th", name: "Alice Wonder", idCode: "64010001" })
    await createUser(db, { email: "bob@kmitl.ac.th", name: "Bob Builder", idCode: "64010002" })

    const byName = await listUsers(db, { search: "alice", page: 1, pageSize: 10 })
    expect(byName.users.map((u) => u.email)).toEqual(["alice@kmitl.ac.th"])

    const byEmail = await listUsers(db, { search: "BOB@", page: 1, pageSize: 10 })
    expect(byEmail.users.map((u) => u.name)).toEqual(["Bob Builder"])

    const byIdCode = await listUsers(db, { search: "64010002", page: 1, pageSize: 10 })
    expect(byIdCode.users.map((u) => u.name)).toEqual(["Bob Builder"])

    const noMatch = await listUsers(db, { search: "zzz", page: 1, pageSize: 10 })
    expect(noMatch.users).toEqual([])
    expect(noMatch.total).toBe(0)
  })

  it("exposes the ID code in the result", async () => {
    await createUser(db, { email: "c@kmitl.ac.th", name: "Carol", idCode: "64010003" })
    const { users } = await listUsers(db, { search: "carol", page: 1, pageSize: 10 })
    expect(users[0].idCode).toBe("64010003")
  })

  it("paginates while keeping total at the full match count", async () => {
    for (let i = 1; i <= 5; i++) {
      await createUser(db, { email: `u${i}@kmitl.ac.th`, name: `User ${i}` })
    }

    const page1 = await listUsers(db, { search: "", page: 1, pageSize: 2 })
    expect(page1.total).toBe(5)
    expect(page1.users.map((u) => u.email)).toEqual(["u1@kmitl.ac.th", "u2@kmitl.ac.th"])

    const page2 = await listUsers(db, { search: "", page: 2, pageSize: 2 })
    expect(page2.users.map((u) => u.email)).toEqual(["u3@kmitl.ac.th", "u4@kmitl.ac.th"])

    const page3 = await listUsers(db, { search: "", page: 3, pageSize: 2 })
    expect(page3.users.map((u) => u.email)).toEqual(["u5@kmitl.ac.th"])
    expect(page3.total).toBe(5)
  })

  it("reports the filtered total when search and pagination combine", async () => {
    for (let i = 1; i <= 5; i++) {
      await createUser(db, { email: `match${i}@kmitl.ac.th`, name: `Match ${i}` })
    }
    await createUser(db, { email: "other@kmitl.ac.th", name: "Other" })

    const result = await listUsers(db, { search: "match", page: 1, pageSize: 2 })
    expect(result.total).toBe(5)
    expect(result.users).toHaveLength(2)
  })
})
