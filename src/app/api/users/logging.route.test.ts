import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { POST as createUser_ } from "./route"
import { PUT as editUser, PATCH as patchUser, DELETE as deleteUser_ } from "./[id]/route"
import { PUT as setRoles } from "./[id]/roles/route"
import { POST as login } from "../auth/login/route"
import { createUser, assignRole } from "@/lib/users/repository"
import { listLogs } from "@/lib/logs"
import { hashPassword } from "@/lib/password"
import { createSessionToken } from "@/lib/auth"
import { freshDb, setTestDb, type Queryable } from "@/lib/test-support/db"

const admin = () => createSessionToken({ email: "admin@kmitl.ac.th", name: "Admin" })
const ctx = (id: number) => ({ params: Promise.resolve({ id: String(id) }) })

function jsonReq(url: string, method: string, body: unknown, token?: string): NextRequest {
  const r = new NextRequest(`http://localhost${url}`, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  if (token) r.cookies.set("session", token)
  return r
}

const newUserBody = {
  firstNameTh: "ทดสอบ",
  lastNameTh: "บันทึก",
  email: "log-target@kmitl.ac.th",
  idCode: "64012345",
}

async function logsByAction(db: Queryable, action: string) {
  return (await listLogs(db, { action, page: 1, pageSize: 50 })).logs
}

describe("activity logging is wired into mutations + login", () => {
  let db: Queryable

  beforeEach(async () => {
    db = freshDb()
    setTestDb(db)
    const a = await createUser(db, { email: "admin@kmitl.ac.th", name: "Admin", idCode: "0" })
    await assignRole(db, a.id, "Admin")
  })

  afterEach(() => setTestDb(null))

  it("logs user.create with actor and target", async () => {
    await createUser_(jsonReq("/api/users", "POST", newUserBody, admin()))
    const logs = await logsByAction(db, "user.create")
    expect(logs).toHaveLength(1)
    expect(logs[0].actorEmail).toBe("admin@kmitl.ac.th")
    expect(logs[0].targetEmail).toBe("log-target@kmitl.ac.th")
  })

  it("logs user.update on edit", async () => {
    const created = await createUser(db, { email: "edit@kmitl.ac.th", name: "E", idCode: "5" })
    await editUser(
      jsonReq(`/api/users/${created.id}`, "PUT", { firstNameTh: "แก้", lastNameTh: "ไข", email: "edit@kmitl.ac.th", idCode: "5" }, admin()),
      ctx(created.id)
    )
    expect((await logsByAction(db, "user.update")).map((l) => l.targetId)).toContain(created.id)
  })

  it("logs user.roles on role change", async () => {
    const created = await createUser(db, { email: "r@kmitl.ac.th", name: "R", idCode: "6" })
    await setRoles(jsonReq(`/api/users/${created.id}/roles`, "PUT", { roles: ["TA"] }, admin()), ctx(created.id))
    expect((await logsByAction(db, "user.roles")).map((l) => l.targetId)).toContain(created.id)
  })

  it("logs user.delete with the removed user's email snapshot", async () => {
    const created = await createUser(db, { email: "del@kmitl.ac.th", name: "D", idCode: "7" })
    await deleteUser_(jsonReq(`/api/users/${created.id}`, "DELETE", {}, admin()), ctx(created.id))
    const logs = await logsByAction(db, "user.delete")
    expect(logs[0].targetEmail).toBe("del@kmitl.ac.th")
  })

  it("logs login on successful sign-in", async () => {
    const u = await createUser(db, {
      email: "member@kmitl.ac.th",
      name: "Member",
      idCode: "8",
      passwordHash: await hashPassword("Password123"),
    })
    await login(jsonReq("/api/auth/login", "POST", { email: "member@kmitl.ac.th", password: "Password123" }))
    const logs = await logsByAction(db, "login")
    expect(logs[0].actorEmail).toBe("member@kmitl.ac.th")
    expect(logs[0].actorId).toBe(u.id)
  })
})
