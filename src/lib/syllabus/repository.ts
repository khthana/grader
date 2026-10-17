import type { Queryable } from "@/lib/db"
import type { CourseKey } from "@/lib/courses/types"
import { EMPTY_SYLLABUS, type Syllabus } from "./draft"

const COURSE = `course_code = $1 AND course_year = $2::int AND course_semester = $3::int`
const keyParams = (key: CourseKey) => [key.code, key.year, key.semester]

/** The offering's Syllabus; one never written reads as empty. */
export async function getSyllabus(db: Queryable, key: CourseKey): Promise<Syllabus> {
  const { rows } = await db.query<Syllabus>(
    `SELECT credits, description, objectives FROM course_syllabi WHERE ${COURSE}`,
    keyParams(key)
  )
  return rows[0] ?? { ...EMPTY_SYLLABUS }
}

/**
 * Replace the offering's Syllabus with `draft`. Run it inside one transaction
 * (the route does) — delete + insert, as pg-mem's ON CONFLICT is weak.
 */
export async function saveSyllabus(
  db: Queryable,
  key: CourseKey,
  draft: Syllabus,
  actorId: number
): Promise<Syllabus> {
  await db.query(`DELETE FROM course_syllabi WHERE ${COURSE}`, keyParams(key))
  await db.query(
    `INSERT INTO course_syllabi
       (course_code, course_year, course_semester, credits, description, objectives, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [...keyParams(key), draft.credits, draft.description, draft.objectives, actorId]
  )
  return getSyllabus(db, key)
}
