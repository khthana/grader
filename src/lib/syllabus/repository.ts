import type { Queryable } from "@/lib/db"
import type { CourseKey } from "@/lib/courses/types"
import { EMPTY_SYLLABUS, type Syllabus } from "./draft"
import type { PlanEntry } from "./plan"
import type { AssessmentComponent } from "./weights"

const COURSE = `course_code = $1 AND course_year = $2::int AND course_semester = $3::int`
const keyParams = (key: CourseKey) => [key.code, key.year, key.semester]

/** The offering's Syllabus; one never written reads as empty. */
export async function getSyllabus(db: Queryable, key: CourseKey): Promise<Syllabus> {
  const { rows } = await db.query<Omit<Syllabus, "plan" | "assessments">>(
    `SELECT credits, description, objectives, resources FROM course_syllabi WHERE ${COURSE}`,
    keyParams(key)
  )
  const { rows: plan } = await db.query<PlanEntry>(
    `SELECT week_no AS "weekNo", topic, detail FROM syllabus_plan_entries
     WHERE ${COURSE} ORDER BY week_no, sort_order, id`,
    keyParams(key)
  )
  // NUMERIC comes back from pg as a string.
  const { rows: assessments } = await db.query<{ name: string; weight: string | number; note: string }>(
    `SELECT name, weight, note FROM syllabus_assessments WHERE ${COURSE} ORDER BY sort_order, id`,
    keyParams(key)
  )
  return {
    ...(rows[0] ?? EMPTY_SYLLABUS),
    plan,
    assessments: assessments.map((a): AssessmentComponent => ({ ...a, weight: Number(a.weight) })),
  }
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
       (course_code, course_year, course_semester, credits, description, objectives, resources, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [...keyParams(key), draft.credits, draft.description, draft.objectives, draft.resources, actorId]
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
  await db.query(`DELETE FROM syllabus_assessments WHERE ${COURSE}`, keyParams(key))
  for (const [i, component] of draft.assessments.entries()) {
    await db.query(
      `INSERT INTO syllabus_assessments
         (course_code, course_year, course_semester, name, weight, note, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [...keyParams(key), component.name, component.weight, component.note, i]
    )
  }
  return getSyllabus(db, key)
}

/**
 * Copy `source`'s Syllabus to `target` as its starting point (Course
 * Duplication, #103) — the main row, the Teaching Plan and the Assessment
 * Components in order. A source never written creates nothing, so the target
 * reads as empty. Staff aren't part of it (they're read live). Runs on the
 * duplication's transaction.
 */
export async function copySyllabus(db: Queryable, source: CourseKey, target: CourseKey, actorId: number): Promise<void> {
  const { rows } = await db.query(`SELECT 1 FROM course_syllabi WHERE ${COURSE}`, keyParams(source))
  if (rows.length === 0) return
  await saveSyllabus(db, target, await getSyllabus(db, source), actorId)
}
