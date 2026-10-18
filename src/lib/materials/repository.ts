import type { Queryable } from "@/lib/db"
import type { CourseKey } from "@/lib/courses/types"
import type { MaterialKind } from "./kinds"
import type { MaterialSummary } from "./outline"
import type { MaterialAddress } from "./params"
import { copyAttachments } from "./attachments/repository"

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

/**
 * Publish or unpublish (#110); null when there is no such Material. Only the
 * switch moves — the body and its last-edited stamp are untouched.
 */
export async function setMaterialPublished(
  db: Queryable,
  key: CourseKey,
  { weekNo, kind }: MaterialAddress,
  published: boolean
): Promise<Material | null> {
  await db.query(
    `UPDATE teaching_materials SET is_published = $6 WHERE ${COURSE} AND week_no = $4::int AND kind = $5`,
    [...keyParams(key), weekNo, kind, published]
  )
  return getMaterial(db, key, weekNo, kind)
}

export type MoveMaterialResult =
  | { ok: true; material: Material; moved: boolean }
  | { ok: false; reason: "not-found" | "target-taken" }

/**
 * Move a Material to another week (#111), keeping its Kind, body and published
 * state. Checked before writing: a week that already holds this Kind refuses
 * the move and nothing changes — so does losing a race for that slot to
 * another write (the UNIQUE constraint). The same week is a no-op (`moved: false`).
 */
export async function moveMaterial(
  db: Queryable,
  key: CourseKey,
  { weekNo, kind }: MaterialAddress,
  toWeekNo: number
): Promise<MoveMaterialResult> {
  const material = await getMaterial(db, key, weekNo, kind)
  if (!material) return { ok: false, reason: "not-found" }
  if (toWeekNo === weekNo) return { ok: true, material, moved: false }
  if (await getMaterial(db, key, toWeekNo, kind)) return { ok: false, reason: "target-taken" }
  try {
    await db.query(
      `UPDATE teaching_materials SET week_no = $6::int WHERE ${COURSE} AND week_no = $4::int AND kind = $5`,
      [...keyParams(key), weekNo, kind, toWeekNo]
    )
  } catch (err) {
    if ((err as { code?: string }).code === "23505") return { ok: false, reason: "target-taken" }
    throw err
  }
  return { ok: true, material: { ...material, weekNo: toWeekNo }, moved: true }
}

/** Delete a Material (#111); false when there was none. */
export async function deleteMaterial(db: Queryable, key: CourseKey, { weekNo, kind }: MaterialAddress): Promise<boolean> {
  const { rows } = await db.query(
    `DELETE FROM teaching_materials WHERE ${COURSE} AND week_no = $4::int AND kind = $5 RETURNING id`,
    [...keyParams(key), weekNo, kind]
  )
  return rows.length > 0
}

/**
 * Course Duplication (#112): every Material — Unplanned ones too — at the same
 * week and Kind with its body, each copy unpublished, with its Attachments
 * (#117 — rows only, the bytes are shared). A source with none creates nothing.
 */
export async function copyMaterials(db: Queryable, source: CourseKey, target: CourseKey, actorId: number): Promise<void> {
  // Not listMaterials: the copy needs each source's id (the Attachments' anchor), which a Material never shows.
  const { rows: materials } = await db.query<{ id: number; weekNo: number; kind: MaterialKind; body: string }>(
    `SELECT id, week_no AS "weekNo", kind, body FROM teaching_materials WHERE ${COURSE} ORDER BY week_no, id`,
    keyParams(source)
  )
  for (const { id, weekNo, kind, body } of materials) {
    const { rows } = await db.query<{ id: number }>(
      `INSERT INTO teaching_materials (course_code, course_year, course_semester, week_no, kind, body, is_published, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, FALSE, $7)
       RETURNING id`,
      [...keyParams(target), weekNo, kind, body, actorId]
    )
    await copyAttachments(db, id, rows[0].id)
  }
}
