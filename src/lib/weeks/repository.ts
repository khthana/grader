import type { Queryable } from "@/lib/db"
import type { CourseKey } from "@/lib/courses/types"
export type { Queryable, CourseKey }

export interface WeekRecord {
  id: number
  courseCode: string
  courseYear: number
  courseSemester: number
  weekNo: number
  topic: string
  isReleased: boolean
}

interface WeekRow {
  id: number
  course_code: string
  course_year: number
  course_semester: number
  week_no: number
  topic: string
  is_released: boolean
}

function toRecord(row: WeekRow): WeekRecord {
  return {
    id: row.id,
    courseCode: row.course_code,
    courseYear: row.course_year,
    courseSemester: row.course_semester,
    weekNo: row.week_no,
    topic: row.topic,
    isReleased: row.is_released,
  }
}

const WEEK_COLS = `id, course_code, course_year, course_semester, week_no, topic, is_released`

export const DEFAULT_WEEKS = 6
export const MAX_WEEKS = 16

export async function seedWeeks(db: Queryable, key: CourseKey): Promise<void> {
  for (let n = 1; n <= DEFAULT_WEEKS; n++) {
    await db.query(
      `INSERT INTO weeks (course_code, course_year, course_semester, week_no, topic)
       VALUES ($1, $2::int, $3::int, $4::int, '')
       ON CONFLICT (course_code, course_year, course_semester, week_no) DO NOTHING`,
      [key.code, key.year, key.semester, n]
    )
  }
}

export async function addWeek(db: Queryable, key: CourseKey): Promise<WeekRecord | null> {
  const { rows: maxRows } = await db.query<{ max: number | null; count: string }>(
    `SELECT MAX(week_no)::int AS max, COUNT(*)::int AS count
     FROM weeks
     WHERE course_code = $1 AND course_year = $2::int AND course_semester = $3::int`,
    [key.code, key.year, key.semester]
  )
  const current = Number(maxRows[0]?.count ?? 0)
  if (current >= MAX_WEEKS) return null
  const nextNo = (maxRows[0]?.max ?? 0) + 1

  const { rows } = await db.query<WeekRow>(
    `INSERT INTO weeks (course_code, course_year, course_semester, week_no, topic)
     VALUES ($1, $2::int, $3::int, $4::int, '')
     RETURNING ${WEEK_COLS}`,
    [key.code, key.year, key.semester, nextNo]
  )
  return toRecord(rows[0])
}

export async function createWeek(
  db: Queryable,
  key: CourseKey,
  data: { weekNo: number; topic: string; isReleased: boolean }
): Promise<WeekRecord> {
  const { rows } = await db.query<WeekRow>(
    `INSERT INTO weeks (course_code, course_year, course_semester, week_no, topic, is_released)
     VALUES ($1, $2::int, $3::int, $4::int, $5, $6)
     RETURNING ${WEEK_COLS}`,
    [key.code, key.year, key.semester, data.weekNo, data.topic, data.isReleased]
  )
  return toRecord(rows[0])
}

export async function weekHasProblems(db: Queryable, weekId: number): Promise<boolean> {
  const { rows } = await db.query<{ count: string }>(
    `SELECT COUNT(*)::int AS count FROM problems WHERE week_id = $1::int`,
    [weekId]
  )
  return Number(rows[0]?.count ?? 0) > 0
}

export async function deleteWeek(db: Queryable, weekId: number): Promise<boolean> {
  const { rows } = await db.query<{ id: number }>(
    `DELETE FROM weeks WHERE id = $1::int RETURNING id`,
    [weekId]
  )
  return rows.length > 0
}

export async function getWeekByNo(
  db: Queryable,
  key: CourseKey,
  weekNo: number
): Promise<WeekRecord | null> {
  const { rows } = await db.query<WeekRow>(
    `SELECT ${WEEK_COLS} FROM weeks
     WHERE course_code = $1 AND course_year = $2::int AND course_semester = $3::int
       AND week_no = $4::int`,
    [key.code, key.year, key.semester, weekNo]
  )
  return rows[0] ? toRecord(rows[0]) : null
}

export async function listWeeks(
  db: Queryable,
  key: CourseKey,
  opts?: { releasedOnly?: boolean }
): Promise<WeekRecord[]> {
  const releasedClause = opts?.releasedOnly ? `AND is_released = TRUE` : ``
  const { rows } = await db.query<WeekRow>(
    `SELECT ${WEEK_COLS}
     FROM weeks
     WHERE course_code = $1 AND course_year = $2::int AND course_semester = $3::int
       ${releasedClause}
     ORDER BY week_no`,
    [key.code, key.year, key.semester]
  )
  return rows.map(toRecord)
}

export async function setWeekReleased(
  db: Queryable,
  weekId: number,
  isReleased: boolean
): Promise<WeekRecord | null> {
  const { rows } = await db.query<WeekRow>(
    `UPDATE weeks SET is_released = $1, updated_at = now()
     WHERE id = $2::int
     RETURNING ${WEEK_COLS}`,
    [isReleased, weekId]
  )
  return rows[0] ? toRecord(rows[0]) : null
}

export async function updateWeekTopic(
  db: Queryable,
  id: number,
  topic: string
): Promise<WeekRecord | null> {
  const { rows } = await db.query<WeekRow>(
    `UPDATE weeks SET topic = $1, updated_at = now()
     WHERE id = $2::int
     RETURNING ${WEEK_COLS}`,
    [topic, id]
  )
  return rows[0] ? toRecord(rows[0]) : null
}
