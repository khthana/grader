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

// Users eligible to be course staff: those carrying the Instructor or TA role,
// optionally filtered by a name/email search. For the assignment picker (which
// course managers use, so it can't go through the Admin-only user list).
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

  // Roles in a second pass (pg-mem lacks STRING_AGG), grouped per user.
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
  courseId: number
): Promise<CourseStaff[]> {
  const { rows } = await db.query<{ id: number; name: string; email: string }>(
    `SELECT u.id, u.name, u.email
     FROM course_instructors ci
     JOIN users u ON u.id = ci.user_id
     WHERE ci.course_id = $1::int
     ORDER BY u.name`,
    [courseId]
  )
  return rows
}

// Replace a course's entire staff set with `userIds` (assign missing, revoke
// dropped). Mirrors setUserRoles.
export async function setCourseInstructors(
  db: Queryable,
  courseId: number,
  userIds: number[]
): Promise<void> {
  await db.query(`DELETE FROM course_instructors WHERE course_id = $1::int`, [courseId])
  for (const userId of userIds) {
    await assignInstructor(db, courseId, userId)
  }
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
