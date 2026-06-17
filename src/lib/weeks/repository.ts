export interface Queryable {
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: T[] }>
}

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

export async function seedWeeks(db: Queryable, courseId: number): Promise<void> {
  for (let n = 1; n <= 8; n++) {
    await db.query(
      `INSERT INTO weeks (course_id, week_no, topic)
       VALUES ($1::int, $2::int, $3)
       ON CONFLICT (course_id, week_no) DO NOTHING`,
      [courseId, n, `สัปดาห์ที่ ${n}`]
    )
  }
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
