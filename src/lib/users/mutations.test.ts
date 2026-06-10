import { describe, it, expect, beforeEach } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { newDb } from "pg-mem"
import {
  createUser,
  getUserById,
  updateUser,
  deleteUser,
  setUserActive,
  type Queryable,
} from "./repository"

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

describe("createUser + getUserById", () => {
  let db: Queryable
  beforeEach(() => {
    db = freshDb()
  })

  it("persists the structured personal fields and reads them back by id", async () => {
    const created = await createUser(db, {
      email: "somchai@kmitl.ac.th",
      name: "สมชาย ใจดี",
      idCode: "64010001",
      titleTh: "นาย",
      firstNameTh: "สมชาย",
      lastNameTh: "ใจดี",
      titleEn: "Mr.",
      firstNameEn: "Somchai",
      lastNameEn: "Jaidee",
      phone: "0812345678",
    })

    const detail = await getUserById(db, created.id)
    expect(detail).not.toBeNull()
    expect(detail?.email).toBe("somchai@kmitl.ac.th")
    expect(detail?.firstNameTh).toBe("สมชาย")
    expect(detail?.lastNameTh).toBe("ใจดี")
    expect(detail?.firstNameEn).toBe("Somchai")
    expect(detail?.phone).toBe("0812345678")
    expect(detail?.idCode).toBe("64010001")
    expect(detail?.isActive).toBe(true)
    expect(detail?.roles).toEqual([])
  })

  it("returns null for an unknown id", async () => {
    expect(await getUserById(db, 9999)).toBeNull()
  })
})

describe("updateUser", () => {
  let db: Queryable
  beforeEach(() => {
    db = freshDb()
  })

  it("updates personal data and reflects it on read", async () => {
    const u = await createUser(db, {
      email: "old@kmitl.ac.th",
      name: "Old Name",
      idCode: "64010001",
      firstNameTh: "เก่า",
      lastNameTh: "นามเดิม",
    })

    const updated = await updateUser(db, u.id, {
      email: "new@kmitl.ac.th",
      name: "ใหม่ นามใหม่",
      idCode: "64019999",
      firstNameTh: "ใหม่",
      lastNameTh: "นามใหม่",
      phone: "0899999999",
    })
    expect(updated?.email).toBe("new@kmitl.ac.th")

    const detail = await getUserById(db, u.id)
    expect(detail?.email).toBe("new@kmitl.ac.th")
    expect(detail?.firstNameTh).toBe("ใหม่")
    expect(detail?.idCode).toBe("64019999")
    expect(detail?.phone).toBe("0899999999")
  })

  it("returns null when updating an unknown id", async () => {
    const result = await updateUser(db, 9999, {
      email: "x@kmitl.ac.th",
      name: "X",
      idCode: "1",
    })
    expect(result).toBeNull()
  })

  it("rejects changing email to one already used by another user", async () => {
    await createUser(db, { email: "taken@kmitl.ac.th", name: "Taken", idCode: "1" })
    const u = await createUser(db, { email: "free@kmitl.ac.th", name: "Free", idCode: "2" })

    await expect(
      updateUser(db, u.id, { email: "taken@kmitl.ac.th", name: "Free", idCode: "2" })
    ).rejects.toThrow()
  })
})

describe("deleteUser", () => {
  let db: Queryable
  beforeEach(() => {
    db = freshDb()
  })

  it("removes a user and returns true", async () => {
    const u = await createUser(db, { email: "d@kmitl.ac.th", name: "D", idCode: "1" })
    expect(await deleteUser(db, u.id)).toBe(true)
    expect(await getUserById(db, u.id)).toBeNull()
  })

  it("returns false for an unknown id", async () => {
    expect(await deleteUser(db, 9999)).toBe(false)
  })
})

describe("setUserActive", () => {
  let db: Queryable
  beforeEach(() => {
    db = freshDb()
  })

  it("toggles is_active", async () => {
    const u = await createUser(db, { email: "a@kmitl.ac.th", name: "A", idCode: "1" })

    await setUserActive(db, u.id, false)
    expect((await getUserById(db, u.id))?.isActive).toBe(false)

    await setUserActive(db, u.id, true)
    expect((await getUserById(db, u.id))?.isActive).toBe(true)
  })

  it("returns false for an unknown id", async () => {
    expect(await setUserActive(db, 9999, false)).toBe(false)
  })
})
