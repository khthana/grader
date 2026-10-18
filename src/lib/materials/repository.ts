import type { Queryable } from "@/lib/db"
import type { CourseKey } from "@/lib/courses/types"
import type { MaterialKind } from "./kinds"
import type { MaterialSummary } from "./outline"
import type { MaterialAddress } from "./params"

/** A Teaching Material as stored — identified by week number + Kind (ADR 0012). */
export interface Material extends MaterialSummary {
  body: string
  updatedAt: string
}

const COURSE = `course_code = $1 AND course_year = $2::int AND course_semester = $3::int`
const keyParams = (key: CourseKey) => [key.code, key.year, key.semester]
const COLS = `week_no AS "weekNo", kind, body, is_published AS "isPublished", updated_at AS "updatedAt"`

/** The offering's Materials, by week (the outline orders Kinds). */
export async function listMaterials(db: Queryable, key: CourseKey): Promise<Material[]> {
  const { rows } = await db.query<Material>(
    `SELECT ${COLS} FROM teaching_materials WHERE ${COURSE} ORDER BY week_no, id`,
    keyParams(key)
  )
  return rows
}

export async function getMaterial(db: Queryable, key: CourseKey, weekNo: number, kind: MaterialKind): Promise<Material | null> {
  const { rows } = await db.query<Material>(
    `SELECT ${COLS} FROM teaching_materials WHERE ${COURSE} AND week_no = $4::int AND kind = $5`,
    [...keyParams(key), weekNo, kind]
  )
  return rows[0] ?? null
}

/**
 * Write the Material's body — the first save creates it (unpublished), later
 * saves update it. Check + INSERT/UPDATE, as pg-mem's ON CONFLICT is weak.
 */
export async function saveMaterial(
  db: Queryable,
  key: CourseKey,
  { weekNo, kind }: MaterialAddress,
  body: string,
  actorId: number
): Promise<Material> {
  const params = [...keyParams(key), weekNo, kind, body, actorId]
  if (await getMaterial(db, key, weekNo, kind)) {
    await db.query(
      `UPDATE teaching_materials SET body = $6, updated_by = $7, updated_at = now()
       WHERE ${COURSE} AND week_no = $4::int AND kind = $5`,
      params
    )
  } else {
    await db.query(
      `INSERT INTO teaching_materials (course_code, course_year, course_semester, week_no, kind, body, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      params
    )
  }
  return (await getMaterial(db, key, weekNo, kind))!
}
