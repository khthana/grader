import type { Queryable } from "@/lib/db"
export type { Queryable }

export interface WeekRecord {
  id: number
  courseId: number
  weekNo: number
  topic: string
}

interface WeekRow {
  id: number
  course_id: number
  week_no: number
  topic: string
}

function toRecord(row: WeekRow): WeekRecord {
  return { id: row.id, courseId: row.course_id, weekNo: row.week_no, topic: row.topic }
}

// New courses start with this many weeks; instructors grow/shrink from here.
export const DEFAULT_WEEKS = 6
// Upper bound on a course's week count (a generous semester).
export const MAX_WEEKS = 16

export async function seedWeeks(db: Queryable, courseId: number): Promise<void> {
  // Topic is left empty (the schema default) — the card UI labels the week by
  // its number, and a duplicate "สัปดาห์ที่ N" topic would just repeat that.
  for (let n = 1; n <= DEFAULT_WEEKS; n++) {
    await db.query(
      `INSERT INTO weeks (course_id, week_no, topic)
       VALUES ($1::int, $2::int, '')
       ON CONFLICT (course_id, week_no) DO NOTHING`,
      [courseId, n]
    )
  }
}

// Append the next week (week_no = current max + 1). Returns null when the course
// already has MAX_WEEKS weeks.
export async function addWeek(db: Queryable, courseId: number): Promise<WeekRecord | null> {
  const { rows: maxRows } = await db.query<{ max: number | null; count: string }>(
    `SELECT MAX(week_no)::int AS max, COUNT(*)::int AS count
     FROM weeks WHERE course_id = $1::int`,
    [courseId]
  )
  const current = Number(maxRows[0]?.count ?? 0)
  if (current >= MAX_WEEKS) return null
  const nextNo = (maxRows[0]?.max ?? 0) + 1

  const { rows } = await db.query<WeekRow>(
    `INSERT INTO weeks (course_id, week_no, topic)
     VALUES ($1::int, $2::int, '')
     RETURNING id, course_id, week_no, topic`,
    [courseId, nextNo]
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

export async function listWeeks(db: Queryable, courseId: number): Promise<WeekRecord[]> {
  const { rows } = await db.query<WeekRow>(
    `SELECT id, course_id, week_no, topic
     FROM weeks
     WHERE course_id = $1::int
     ORDER BY week_no`,
    [courseId]
  )
  return rows.map(toRecord)
}

export async function updateWeekTopic(
  db: Queryable,
  id: number,
  topic: string
): Promise<WeekRecord | null> {
  const { rows } = await db.query<WeekRow>(
    `UPDATE weeks SET topic = $1, updated_at = now()
     WHERE id = $2::int
     RETURNING id, course_id, week_no, topic`,
    [topic, id]
  )
  return rows[0] ? toRecord(rows[0]) : null
}
