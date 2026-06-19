// Test harness. NOT imported by production code.
// Centralises freshDb, sessionFor, and the course fixture so tests don't
// hand-count schema.sql paths or re-implement the pg-mem setup.

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { newDb } from "pg-mem"
import { createUser, assignRole } from "@/lib/users/repository"
import { createCourse, assignInstructor } from "@/lib/courses/repository"
import { seedWeeks } from "@/lib/weeks/repository"
import { createSessionToken } from "@/lib/auth"
import { setTestDb } from "@/lib/db"
import type { Queryable } from "@/lib/db"
import type { CourseRecord } from "@/lib/courses/types"

export type { Queryable }

const schema = readFileSync(
  fileURLToPath(new URL("../../../schema.sql", import.meta.url)),
  "utf8"
)

/** Create an in-memory pg-mem pool loaded with the full schema. */
export function freshDb(): Queryable {
  const mem = newDb()
  mem.public.none(schema)
  const { Pool } = mem.adapters.createPg()
  return new Pool() as unknown as Queryable
}

/** Create a signed session cookie value for the given email. */
export const sessionFor = (email: string): string =>
  createSessionToken({ email, name: "x" })

export interface CourseFixture {
  db: Queryable
  course: CourseRecord
  ins: { id: number; email: string; name: string }
  ta: { id: number; email: string; name: string }
}

/**
 * Seed a pg-mem DB with an Instructor, a TA, a Course, staff assignments,
 * and default weeks. Caller must still call setTestDb(f.db) + setTestDb(null).
 */
export async function courseFixture(): Promise<CourseFixture> {
  const db = freshDb()
  const ins = await createUser(db, { email: "ins@kmitl.ac.th", name: "Ins" })
  await assignRole(db, ins.id, "Instructor")
  const ta = await createUser(db, { email: "ta@kmitl.ac.th", name: "TA" })
  await assignRole(db, ta.id, "TA")
  const course = await createCourse(db, {
    code: "C01",
    year: 2567,
    semester: 1,
    nameTh: "ก",
    nameEn: "A",
  })
  await assignInstructor(db, course, ins.id)
  await assignInstructor(db, course, ta.id)
  await seedWeeks(db, course)
  return { db, ins, ta, course }
}

export { setTestDb }
