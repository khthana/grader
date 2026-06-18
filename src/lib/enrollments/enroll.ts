// Enroll service — the orchestration behind adding a student to a course roster.
// Finds-or-creates the User by id_code, ensures the Student role, derives a
// login email and inherits the course's default program, then creates the
// enrollment. Returns a discriminated result so callers (single add + bulk
// import) can react without try/catch.

import type { Queryable } from "@/lib/db"
import { createEnrollment, findEnrollment } from "./repository"
import { getCourseById } from "@/lib/courses/repository"
import {
  createUser,
  findUserByIdCode,
  assignRole,
} from "@/lib/users/repository"

export interface EnrollInput {
  idCode: string
  titleTh?: string | null
  firstNameTh: string
  lastNameTh: string
  email?: string | null
  studyGroup?: string | null
  program?: string | null
  year?: string | null
}

export type EnrollResult =
  | { ok: true; created: boolean; userId: number; enrollmentId: number }
  | { ok: false; reason: "duplicate" }

function blank(value: string | null | undefined): boolean {
  return !value || value.trim() === ""
}

export async function enrollStudent(
  db: Queryable,
  courseId: number,
  input: EnrollInput
): Promise<EnrollResult> {
  const course = await getCourseById(db, courseId)

  // Find-or-create the user by id_code.
  const existing = await findUserByIdCode(db, input.idCode)
  let userId: number
  let created: boolean

  if (existing) {
    // Already enrolled in this course → duplicate.
    if (await findEnrollment(db, courseId, existing.id)) {
      return { ok: false, reason: "duplicate" }
    }
    userId = existing.id
    created = false
  } else {
    const email = blank(input.email)
      ? `${input.idCode.trim()}@kmitl.ac.th`
      : input.email!.trim()
    const name = `${input.firstNameTh.trim()} ${input.lastNameTh.trim()}`.trim()
    const user = await createUser(db, {
      email,
      name,
      idCode: input.idCode.trim(),
      titleTh: input.titleTh ?? null,
      firstNameTh: input.firstNameTh.trim(),
      lastNameTh: input.lastNameTh.trim(),
    })
    userId = user.id
    created = true
  }

  // Ensure the Student role (no-op if already assigned). Existing users keep
  // their stored name — we never overwrite it here.
  await assignRole(db, userId, "Student")

  const program = blank(input.program) ? course?.program ?? null : input.program!.trim()
  const enrollment = await createEnrollment(db, {
    courseId,
    userId,
    studyGroup: input.studyGroup ?? null,
    program,
    year: input.year ?? null,
  })

  return { ok: true, created, userId, enrollmentId: enrollment.id }
}
