import type { Queryable } from "@/lib/db"
import type { CourseKey } from "@/lib/courses/types"
import type { MaterialKind } from "../kinds"
import type { MaterialAddress } from "../params"

/** An Attachment as viewers read it — the stored hash stays server-side. */
export interface Attachment {
  id: number
  name: string
  contentType: string
  sizeBytes: number
  uploadedAt: string
}

/** What an upload records for one file: its checked name and type, and its stored bytes. */
export interface AttachmentFile {
  name: string
  contentType: string
  sizeBytes: number
  sha256: string
}

/** An Attachment with what serving it needs: its bytes' hash and its Material. */
export interface StoredAttachment extends Attachment {
  sha256: string
  material: MaterialAddress & { isPublished: boolean }
}

const COLS = `a.id, a.name, a.content_type AS "contentType", a.size_bytes AS "sizeBytes", a.uploaded_at AS "uploadedAt"`
// COLS for a row just written (no join, so no alias).
const RETURNING_COLS = `id, name, content_type AS "contentType", size_bytes AS "sizeBytes", uploaded_at AS "uploadedAt"`
const MATERIAL_AT = `m.course_code = $1 AND m.course_year = $2::int AND m.course_semester = $3::int
  AND m.week_no = $4::int AND m.kind = $5`
const addressParams = (key: CourseKey, { weekNo, kind }: MaterialAddress) => [key.code, key.year, key.semester, weekNo, kind]

/** The Material's id — the Attachments' anchor (ADR 0012) — or null when it doesn't exist. */
export async function findMaterialId(db: Queryable, key: CourseKey, address: MaterialAddress): Promise<number | null> {
  const { rows } = await db.query<{ id: number }>(
    `SELECT m.id FROM teaching_materials m WHERE ${MATERIAL_AT}`,
    addressParams(key, address)
  )
  return rows[0]?.id ?? null
}

/** A Material's Attachments, in upload order. */
export async function listAttachments(db: Queryable, key: CourseKey, address: MaterialAddress): Promise<Attachment[]> {
  const { rows } = await db.query<Attachment>(
    `SELECT ${COLS} FROM material_attachments a JOIN teaching_materials m ON m.id = a.material_id
     WHERE ${MATERIAL_AT} ORDER BY a.id`,
    addressParams(key, address)
  )
  return rows
}

/**
 * Every Attachment of the course's Materials (#120), in upload order, with
 * its Material's address — one query for the whole outline.
 */
export async function listCourseAttachments(
  db: Queryable,
  key: CourseKey
): Promise<(Pick<Attachment, "id" | "name" | "sizeBytes"> & MaterialAddress)[]> {
  const { rows } = await db.query<Pick<Attachment, "id" | "name" | "sizeBytes"> & MaterialAddress>(
    `SELECT a.id, a.name, a.size_bytes AS "sizeBytes", m.week_no AS "weekNo", m.kind
     FROM material_attachments a JOIN teaching_materials m ON m.id = a.material_id
     WHERE m.course_code = $1 AND m.course_year = $2::int AND m.course_semester = $3::int ORDER BY a.id`,
    [key.code, key.year, key.semester]
  )
  return rows
}

/**
 * Record a new Attachment; null when the Material already has one of that
 * name (checked first, and a lost race on the UNIQUE constraint answers the same).
 */
export async function createAttachment(
  db: Queryable,
  materialId: number,
  file: AttachmentFile,
  actorId: number
): Promise<Attachment | null> {
  const { rows: taken } = await db.query(
    `SELECT 1 FROM material_attachments WHERE material_id = $1::int AND name = $2`,
    [materialId, file.name]
  )
  if (taken.length > 0) return null
  try {
    const { rows } = await db.query<Attachment>(
      `INSERT INTO material_attachments (material_id, name, content_type, size_bytes, sha256, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${RETURNING_COLS}`,
      [materialId, file.name, file.contentType, file.sizeBytes, file.sha256, actorId]
    )
    return rows[0]
  } catch (err) {
    if ((err as { code?: string }).code === "23505") return null
    throw err
  }
}

/**
 * Point the Material's Attachment of this name at new bytes (#115) — same id
 * and name, so whatever refers to it keeps working. Null when there is none.
 */
export async function replaceAttachment(
  db: Queryable,
  materialId: number,
  file: AttachmentFile,
  actorId: number
): Promise<Attachment | null> {
  const { rows } = await db.query<Attachment>(
    `UPDATE material_attachments
     SET content_type = $3, size_bytes = $4, sha256 = $5, uploaded_by = $6, uploaded_at = now()
     WHERE material_id = $1::int AND name = $2
     RETURNING ${RETURNING_COLS}`,
    [materialId, file.name, file.contentType, file.sizeBytes, file.sha256, actorId]
  )
  return rows[0] ?? null
}

/**
 * Delete one Attachment of this course (#115); returns what was deleted (its
 * name and Material, for the log), or null when it isn't this course's. The
 * bytes stay until a sweep finds them unreferenced.
 */
export async function deleteAttachment(db: Queryable, key: CourseKey, id: number): Promise<StoredAttachment | null> {
  const attachment = await getAttachmentForCourse(db, key, id)
  if (!attachment) return null
  await db.query(`DELETE FROM material_attachments WHERE id = $1::int`, [id])
  return attachment
}

/**
 * Course Duplication (#117, ADR 0013): give the copied Material its source's
 * Attachments — same names, same hashes, no bytes copied. From then on each
 * row is its own: replacing or deleting one never touches the other, and the
 * shared bytes stay while any row still refers to them.
 */
export async function copyAttachments(db: Queryable, sourceMaterialId: number, targetMaterialId: number): Promise<void> {
  await db.query(
    `INSERT INTO material_attachments (material_id, name, content_type, size_bytes, sha256, uploaded_by)
     SELECT $2::int, name, content_type, size_bytes, sha256, uploaded_by
     FROM material_attachments WHERE material_id = $1::int ORDER BY id`,
    [sourceMaterialId, targetMaterialId]
  )
}

/** Every hash some Attachment refers to — what a sweep must keep. */
export async function listReferencedHashes(db: Queryable): Promise<string[]> {
  const { rows } = await db.query<{ sha256: string }>(`SELECT DISTINCT sha256 FROM material_attachments`)
  return rows.map((r) => r.sha256)
}

/** One Attachment of this course with its Material — null when it isn't this course's. */
export async function getAttachmentForCourse(db: Queryable, key: CourseKey, id: number): Promise<StoredAttachment | null> {
  const { rows } = await db.query<
    Attachment & { sha256: string; weekNo: number; kind: MaterialKind; isPublished: boolean }
  >(
    `SELECT ${COLS}, a.sha256, m.week_no AS "weekNo", m.kind, m.is_published AS "isPublished"
     FROM material_attachments a JOIN teaching_materials m ON m.id = a.material_id
     WHERE a.id = $4::int AND m.course_code = $1 AND m.course_year = $2::int AND m.course_semester = $3::int`,
    [key.code, key.year, key.semester, id]
  )
  if (!rows[0]) return null
  const { weekNo, kind, isPublished, ...attachment } = rows[0]
  return { ...attachment, material: { weekNo, kind, isPublished } }
}
