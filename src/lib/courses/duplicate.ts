import type { Queryable } from "@/lib/db"
import type { CourseKey, CourseRecord } from "@/lib/courses/types"
import {
  createCourse,
  getCourseByKey,
  listCourseInstructors,
  setCourseInstructors,
} from "@/lib/courses/repository"
import { listWeeks, createWeek } from "@/lib/weeks/repository"

export type DuplicateResult =
  | { ok: true; course: CourseRecord }
  | { ok: false; reason: "target-exists" | "same-as-source" }

export async function duplicateCourseOffering(
  db: Queryable,
  source: CourseKey,
  target: { year: number; semester: number },
  actorId: number
): Promise<DuplicateResult> {
  if (source.year === target.year && source.semester === target.semester) {
    return { ok: false, reason: "same-as-source" }
  }

  const src = await getCourseByKey(db, source)
  if (!src) {
    // Callers (the duplicate route) authorize the source first, so a missing
    // source is an invariant violation rather than an expected outcome.
    throw new Error(
      `duplicateCourseOffering: source ${source.code}/${source.year}/${source.semester} not found`
    )
  }

  const targetKey = { code: src.code, year: target.year, semester: target.semester }
  if (await getCourseByKey(db, targetKey)) {
    return { ok: false, reason: "target-exists" }
  }

  const course = await createCourse(db, {
    code: src.code,
    year: target.year,
    semester: target.semester,
    nameTh: src.nameTh,
    nameEn: src.nameEn,
    program: src.program ?? undefined,
  })

  const instructors = await listCourseInstructors(db, source)
  const ids = new Set(instructors.map((i) => i.id))
  ids.add(actorId)
  await setCourseInstructors(db, course, [...ids])

  const weeks = await listWeeks(db, source)
  for (const week of weeks) {
    await createWeek(db, course, {
      weekNo: week.weekNo,
      topic: week.topic,
      isReleased: false,
    })
  }

  return { ok: true, course }
}
