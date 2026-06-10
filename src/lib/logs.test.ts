import { describe, it, expect, beforeEach } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { newDb } from "pg-mem"
import { writeLog, listLogs } from "./logs"
import type { Queryable } from "./users/repository"

const schema = readFileSync(
  fileURLToPath(new URL("../../schema.sql", import.meta.url)),
  "utf8"
)

function freshDb(): Queryable {
  const mem = newDb()
  mem.public.none(schema)
  const { Pool } = mem.adapters.createPg()
  return new Pool() as unknown as Queryable
}

describe("activity log", () => {
  let db: Queryable
  beforeEach(() => {
    db = freshDb()
  })

  it("writes an entry and lists it back with actor, action, target", async () => {
    await writeLog(db, {
      actorId: 1,
      actorEmail: "admin@kmitl.ac.th",
      action: "user.create",
      targetId: 7,
      targetEmail: "new@kmitl.ac.th",
    })

    const { logs, total } = await listLogs(db, { page: 1, pageSize: 10 })
    expect(total).toBe(1)
    expect(logs).toHaveLength(1)
    expect(logs[0].actorEmail).toBe("admin@kmitl.ac.th")
    expect(logs[0].action).toBe("user.create")
    expect(logs[0].targetEmail).toBe("new@kmitl.ac.th")
    expect(logs[0].createdAt).toBeTruthy()
  })

  it("filters by action", async () => {
    await writeLog(db, { action: "user.create", actorEmail: "a@x" })
    await writeLog(db, { action: "login", actorEmail: "b@x" })
    await writeLog(db, { action: "login", actorEmail: "c@x" })

    const logins = await listLogs(db, { action: "login", page: 1, pageSize: 10 })
    expect(logins.total).toBe(2)
    expect(logins.logs.every((l) => l.action === "login")).toBe(true)
  })

  it("orders newest-first and paginates", async () => {
    for (let i = 1; i <= 5; i++) {
      await writeLog(db, { action: "login", actorEmail: `u${i}@x` })
    }
    const page1 = await listLogs(db, { page: 1, pageSize: 2 })
    expect(page1.total).toBe(5)
    // newest (last written) first
    expect(page1.logs.map((l) => l.actorEmail)).toEqual(["u5@x", "u4@x"])

    const page2 = await listLogs(db, { page: 2, pageSize: 2 })
    expect(page2.logs.map((l) => l.actorEmail)).toEqual(["u3@x", "u2@x"])
  })
})
