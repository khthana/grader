import type { Queryable } from "@/lib/db"
import type { CourseKey, CourseRecord } from "./types"
export type { Queryable, CourseKey, CourseRecord }

export interface NewCourse {
  code: string
  year: number
  semester: number
  nameTh: string
  nameEn: string
  program?: string | null
}

interface CourseRow {
  code: string
  year: number
  semester: number
  name_th: string
  name_en: string
  program: string | null
  created_at: string
}

function toRecord(row: CourseRow): CourseRecord {
  return {
    code: row.code,
    year: row.year,
    semester: row.semester,
    nameTh: row.name_th,
    nameEn: row.name_en,
    program: row.program,
    createdAt: row.created_at,
  }
}

const SELECT_COLS =
  `code, year, semester, name_th, name_en, program, created_at`

export async function createCourse(
  db: Queryable,
  input: NewCourse
): Promise<CourseRecord> {
  const { rows } = await db.query<CourseRow>(
    `INSERT INTO courses (code, year, semester, name_th, name_en, program)
     VALUES ($1, $2::int, $3::int, $4, $5, $6)
     RETURNING ${SELECT_COLS}`,
    [input.code, input.year, input.semester, input.nameTh, input.nameEn, input.program ?? null]
  )
  return toRecord(rows[0])
}

export async function getCourseByKey(
  db: Queryable,
  key: CourseKey
): Promise<CourseRecord | null> {
  const { rows } = await db.query<CourseRow>(
    `SELECT ${SELECT_COLS} FROM courses
     WHERE code = $1 AND year = $2::int AND semester = $3::int`,
    [key.code, key.year, key.semester]
  )
  return rows[0] ? toRecord(rows[0]) : null
}

export async function updateCourse(
  db: Queryable,
  key: CourseKey,
  input: Pick<NewCourse, "nameTh" | "nameEn" | "program">
): Promise<CourseRecord | null> {
  const { rows } = await db.query<CourseRow>(
    `UPDATE courses
     SET name_th = $4, name_en = $5, program = $6, updated_at = now()
     WHERE code = $1 AND year = $2::int AND semester = $3::int
     RETURNING ${SELECT_COLS}`,
    [key.code, key.year, key.semester, input.nameTh, input.nameEn, input.program ?? null]
  )
  return rows[0] ? toRecord(rows[0]) : null
}

export interface CourseCascadeCounts {
  students: number
  problems: number
  submissions: number
}

/**
 * Counts the meaningful data that an `ON DELETE CASCADE` would destroy along
 * with a course. Weeks and instructor assignments are scaffolding created at
 * course creation, so they are intentionally excluded — an "empty" course
 * (only seeded weeks + its creator) reports all zeros and can be deleted
 * without a confirmation prompt.
 */
export async function getCourseCascadeCounts(
  db: Queryable,
  key: CourseKey
): Promise<CourseCascadeCounts> {
  const params = [key.code, key.year, key.semester]
  const where = `course_code = $1 AND course_year = $2::int AND course_semester = $3::int`

  const [students, problems, submissions] = await Promise.all([
    db.query<{ n: string }>(`SELECT COUNT(*)::int AS n FROM enrollments WHERE ${where}`, params),
    db.query<{ n: string }>(`SELECT COUNT(*)::int AS n FROM problems WHERE ${where}`, params),
    db.query<{ n: string }>(`SELECT COUNT(*)::int AS n FROM submissions WHERE ${where}`, params),
  ])

  return {
    students: Number(students.rows[0].n),
    problems: Number(problems.rows[0].n),
    submissions: Number(submissions.rows[0].n),
  }
}

export async function deleteCourse(
  db: Queryable,
  key: CourseKey
): Promise<boolean> {
  const { rows } = await db.query<{ code: string }>(
    `DELETE FROM courses WHERE code = $1 AND year = $2::int AND semester = $3::int
     RETURNING code`,
    [key.code, key.year, key.semester]
  )
  return rows.length > 0
}

export async function assignInstructor(
  db: Queryable,
  key: CourseKey,
  userId: number
): Promise<void> {
  await db.query(
    `INSERT INTO course_instructors (course_code, course_year, course_semester, user_id)
     VALUES ($1, $2::int, $3::int, $4::int)
     ON CONFLICT (course_code, course_year, course_semester, user_id) DO NOTHING`,
    [key.code, key.year, key.semester, userId]
  )
}

export interface CourseStaff {
  id: number
  name: string
  email: string
}

export interface StaffCandidate {
  id: number
  name: string
  email: string
  roles: string[]
}

export async function searchStaffCandidates(
  db: Queryable,
  search: string
): Promise<StaffCandidate[]> {
  const hasSearch = search.trim() !== ""
  const params: unknown[] = []
  let filter = ""
  if (hasSearch) {
    params.push(`%${search.trim()}%`)
    filter = `AND (u.name ILIKE $1 OR u.email ILIKE $1)`
  }

  const { rows } = await db.query<{ id: number; name: string; email: string }>(
    `SELECT DISTINCT u.id, u.name, u.email
     FROM users u
     JOIN user_roles ur ON ur.user_id = u.id
     JOIN roles r ON r.id = ur.role_id
     WHERE r.name IN ('Instructor', 'TA') ${filter}
     ORDER BY u.name
     LIMIT 20`,
    params
  )
  if (rows.length === 0) return []

  const ids = rows.map((r) => r.id)
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(",")
  const { rows: roleRows } = await db.query<{ user_id: number; name: string }>(
    `SELECT ur.user_id, r.name
     FROM user_roles ur JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id IN (${placeholders})
     ORDER BY r.name`,
    ids
  )
  const byUser = new Map<number, string[]>()
  for (const rr of roleRows) {
    const list = byUser.get(rr.user_id) ?? []
    list.push(rr.name)
    byUser.set(rr.user_id, list)
  }

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    roles: byUser.get(r.id) ?? [],
  }))
}

export async function listCourseInstructors(
  db: Queryable,
  key: CourseKey
): Promise<CourseStaff[]> {
  const { rows } = await db.query<{ id: number; name: string; email: string }>(
    `SELECT u.id, u.name, u.email
     FROM course_instructors ci
     JOIN users u ON u.id = ci.user_id
     WHERE ci.course_code = $1 AND ci.course_year = $2::int AND ci.course_semester = $3::int
     ORDER BY u.name`,
    [key.code, key.year, key.semester]
  )
  return rows
}

export async function setCourseInstructors(
  db: Queryable,
  key: CourseKey,
  userIds: number[]
): Promise<void> {
  await db.query(
    `DELETE FROM course_instructors
     WHERE course_code = $1 AND course_year = $2::int AND course_semester = $3::int`,
    [key.code, key.year, key.semester]
  )
  for (const userId of userIds) {
    await assignInstructor(db, key, userId)
  }
}

export async function listCoursesForUser(
  db: Queryable,
  userId: number,
  roles: string[]
): Promise<CourseRecord[]> {
  if (roles.includes("Admin")) {
    const { rows } = await db.query<CourseRow>(
      `SELECT ${SELECT_COLS} FROM courses ORDER BY code, year, semester`
    )
    return rows.map(toRecord)
  }

  const { rows } = await db.query<CourseRow>(
    `SELECT DISTINCT c.code, c.year, c.semester, c.name_th, c.name_en, c.program, c.created_at
     FROM courses c
     JOIN (
       SELECT course_code, course_year, course_semester FROM course_instructors WHERE user_id = $1::int
       UNION
       SELECT course_code, course_year, course_semester FROM enrollments WHERE user_id = $1::int
     ) entitled ON entitled.course_code = c.code
               AND entitled.course_year = c.year
               AND entitled.course_semester = c.semester
     ORDER BY c.code, c.year, c.semester`,
    [userId]
  )
  return rows.map(toRecord)
}

export async function listCourses(db: Queryable): Promise<CourseRecord[]> {
  const { rows } = await db.query<CourseRow>(
    `SELECT ${SELECT_COLS} FROM courses ORDER BY code, year, semester`
  )
  return rows.map(toRecord)
}
