// Course repository — raw SQL over a `pg`-compatible client.
// Takes an injectable `Queryable` so production passes a real pool and tests
// pass a pg-mem adapter (mirrors src/lib/users/repository.ts).

export interface Queryable {
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: T[] }>
}

export interface NewCourse {
  code: string
  nameTh: string
  nameEn: string
  program?: string | null
}

export interface CourseRecord {
  id: number
  code: string
  nameTh: string
  nameEn: string
  program: string | null
}

interface CourseRow {
  id: number
  code: string
  name_th: string
  name_en: string
  program: string | null
}

function toRecord(row: CourseRow): CourseRecord {
  return {
    id: row.id,
    code: row.code,
    nameTh: row.name_th,
    nameEn: row.name_en,
    program: row.program,
  }
}

export async function createCourse(db: Queryable, input: NewCourse): Promise<CourseRecord> {
  const { rows } = await db.query<CourseRow>(
    `INSERT INTO courses (code, name_th, name_en, program)
     VALUES ($1, $2, $3, $4)
     RETURNING id, code, name_th, name_en, program`,
    [input.code, input.nameTh, input.nameEn, input.program ?? null]
  )
  return toRecord(rows[0])
}

export async function findCourseByCode(
  db: Queryable,
  code: string
): Promise<CourseRecord | null> {
  const { rows } = await db.query<CourseRow>(
    `SELECT id, code, name_th, name_en, program FROM courses WHERE code = $1`,
    [code.trim()]
  )
  return rows[0] ? toRecord(rows[0]) : null
}

export async function getCourseById(db: Queryable, id: number): Promise<CourseRecord | null> {
  const { rows } = await db.query<CourseRow>(
    `SELECT id, code, name_th, name_en, program FROM courses WHERE id = $1`,
    [id]
  )
  return rows[0] ? toRecord(rows[0]) : null
}

export async function updateCourse(
  db: Queryable,
  id: number,
  input: NewCourse
): Promise<CourseRecord | null> {
  const { rows } = await db.query<CourseRow>(
    `UPDATE courses
     SET code = $2, name_th = $3, name_en = $4, program = $5, updated_at = now()
     WHERE id = $1::int
     RETURNING id, code, name_th, name_en, program`,
    [id, input.code, input.nameTh, input.nameEn, input.program ?? null]
  )
  return rows[0] ? toRecord(rows[0]) : null
}

export async function deleteCourse(db: Queryable, id: number): Promise<boolean> {
  const { rows } = await db.query<{ id: number }>(
    `DELETE FROM courses WHERE id = $1::int RETURNING id`,
    [id]
  )
  return rows.length > 0
}

export async function assignInstructor(
  db: Queryable,
  courseId: number,
  userId: number
): Promise<void> {
  await db.query(
    `INSERT INTO course_instructors (course_id, user_id)
     VALUES ($1::int, $2::int)
     ON CONFLICT (course_id, user_id) DO NOTHING`,
    [courseId, userId]
  )
}

// Courses a user may manage: Admin sees all; everyone else sees only the
// courses they're assigned to via course_instructors.
export async function listCoursesForUser(
  db: Queryable,
  userId: number,
  roles: string[]
): Promise<CourseRecord[]> {
  if (roles.includes("Admin")) {
    const { rows } = await db.query<CourseRow>(
      `SELECT id, code, name_th, name_en, program FROM courses ORDER BY code`
    )
    return rows.map(toRecord)
  }

  const { rows } = await db.query<CourseRow>(
    `SELECT c.id, c.code, c.name_th, c.name_en, c.program
     FROM courses c
     JOIN course_instructors ci ON ci.course_id = c.id
     WHERE ci.user_id = $1::int
     ORDER BY c.code`,
    [userId]
  )
  return rows.map(toRecord)
}
