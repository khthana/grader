import type { Queryable } from "@/lib/db"
import type { CourseKey } from "@/lib/courses/types"
import { EMPTY_SYLLABUS, type Syllabus } from "./draft"
import type { PlanEntry } from "./plan"

const COURSE = `course_code = $1 AND course_year = $2::int AND course_semester = $3::int`
const keyParams = (key: CourseKey) => [key.code, key.year, key.semester]

/** The offering's Syllabus; one never written reads as empty. */
export async function getSyllabus(db: Queryable, key: CourseKey): Promise<Syllabus> {
  const { rows } = await db.query<Omit<Syllabus, "plan">>(
    `SELECT credits, description, objectives FROM course_syllabi WHERE ${COURSE}`,
    keyParams(key)
  )
  const { rows: plan } = await db.query<PlanEntry>(
    `SELECT week_no AS "weekNo", topic, detail FROM syllabus_plan_entries
     WHERE ${COURSE} ORDER BY week_no, sort_order, id`,
    keyParams(key)
  )
  return { ...(rows[0] ?? EMPTY_SYLLABUS), plan }
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
  await db.query(`DELETE FROM syllabus_plan_entries WHERE ${COURSE}`, keyParams(key))
  for (const [i, entry] of draft.plan.entries()) {
    await db.query(
      `INSERT INTO syllabus_plan_entries
         (course_code, course_year, course_semester, week_no, topic, detail, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [...keyParams(key), entry.weekNo, entry.topic, entry.detail, i]
    )
  }
  return getSyllabus(db, key)
}
