import type { Queryable } from "@/lib/db"
import type { CourseKey } from "@/lib/courses/types"
import { createEnrollment, findEnrollment } from "./repository"
import { getCourseByKey } from "@/lib/courses/repository"
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
  | { ok: true; created: boolean; userId: number }
  | { ok: false; reason: "duplicate" }

function blank(value: string | null | undefined): boolean {
  return !value || value.trim() === ""
}

export async function enrollStudent(
  db: Queryable,
  courseKey: CourseKey,
  input: EnrollInput
): Promise<EnrollResult> {
  const course = await getCourseByKey(db, courseKey)

  const existing = await findUserByIdCode(db, input.idCode)
  let userId: number
  let created: boolean

  if (existing) {
    if (await findEnrollment(db, courseKey, existing.id)) {
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

  await assignRole(db, userId, "Student")

  const program = blank(input.program) ? course?.program ?? null : input.program!.trim()
  await createEnrollment(db, {
    courseCode: courseKey.code,
    courseYear: courseKey.year,
    courseSemester: courseKey.semester,
    userId,
    studyGroup: input.studyGroup ?? null,
    program,
    year: input.year ?? null,
  })

  return { ok: true, created, userId }
}
