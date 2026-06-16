// Enrollment repository — raw SQL over a `pg`-compatible client (injectable
// `Queryable`, mirrors src/lib/users/repository.ts). Course-scoped roster reads.

export interface Queryable {
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: T[] }>
}

export interface NewEnrollment {
  courseId: number
  userId: number
  studyGroup?: string | null
  program?: string | null
  year?: string | null
}

export interface EnrollmentRecord {
  id: number
  courseId: number
  userId: number
  studyGroup: string | null
  program: string | null
  year: string | null
}

export interface EnrollmentListItem {
  id: number
  userId: number
  sid: string | null
  prefix: string | null
  name: string
  program: string | null
  studyGroup: string | null
  year: string | null
}

export interface ListEnrollmentsParams {
  courseId: number
  search: string
  group: string
  page: number
  pageSize: number
}

export interface EnrollmentListPage {
  enrollments: EnrollmentListItem[]
  total: number
}

interface EnrollmentRow {
  id: number
  course_id: number
  user_id: number
  study_group: string | null
  program: string | null
  year: string | null
}

function toRecord(row: EnrollmentRow): EnrollmentRecord {
  return {
    id: row.id,
    courseId: row.course_id,
    userId: row.user_id,
    studyGroup: row.study_group,
    program: row.program,
    year: row.year,
  }
}

export async function createEnrollment(
  db: Queryable,
  input: NewEnrollment
): Promise<EnrollmentRecord> {
  const { rows } = await db.query<EnrollmentRow>(
    `INSERT INTO enrollments (course_id, user_id, study_group, program, year)
     VALUES ($1::int, $2::int, $3, $4, $5)
     RETURNING id, course_id, user_id, study_group, program, year`,
    [
      input.courseId,
      input.userId,
      input.studyGroup ?? null,
      input.program ?? null,
      input.year ?? null,
    ]
  )
  return toRecord(rows[0])
}

export async function findEnrollment(
  db: Queryable,
  courseId: number,
  userId: number
): Promise<EnrollmentRecord | null> {
  const { rows } = await db.query<EnrollmentRow>(
    `SELECT id, course_id, user_id, study_group, program, year
     FROM enrollments WHERE course_id = $1::int AND user_id = $2::int`,
    [courseId, userId]
  )
  return rows[0] ? toRecord(rows[0]) : null
}

export async function getEnrollmentById(
  db: Queryable,
  id: number
): Promise<EnrollmentRecord | null> {
  const { rows } = await db.query<EnrollmentRow>(
    `SELECT id, course_id, user_id, study_group, program, year
     FROM enrollments WHERE id = $1::int`,
    [id]
  )
  return rows[0] ? toRecord(rows[0]) : null
}

export async function deleteEnrollment(db: Queryable, id: number): Promise<boolean> {
  const { rows } = await db.query<{ id: number }>(
    `DELETE FROM enrollments WHERE id = $1::int RETURNING id`,
    [id]
  )
  return rows.length > 0
}

export interface UpdateEnrollment {
  studyGroup?: string | null
  program?: string | null
  year?: string | null
}

export async function updateEnrollment(
  db: Queryable,
  id: number,
  input: UpdateEnrollment
): Promise<EnrollmentRecord | null> {
  const { rows } = await db.query<EnrollmentRow>(
    `UPDATE enrollments
     SET study_group = $2, program = $3, year = $4
     WHERE id = $1::int
     RETURNING id, course_id, user_id, study_group, program, year`,
    [id, input.studyGroup ?? null, input.program ?? null, input.year ?? null]
  )
  return rows[0] ? toRecord(rows[0]) : null
}

interface EnrollmentListRow {
  id: number
  user_id: number
  sid: string | null
  prefix: string | null
  name: string
  program: string | null
  study_group: string | null
  year: string | null
}

export async function listEnrollments(
  db: Queryable,
  { courseId, search, group, page, pageSize }: ListEnrollmentsParams
): Promise<EnrollmentListPage> {
  // Build the dynamic predicate: course scope is always present; search and
  // group are optional. Params are positional so the JOIN/count stay in sync.
  const conditions = ["e.course_id = $1::int"]
  const params: unknown[] = [courseId]

  if (search.trim() !== "") {
    params.push(`%${search.trim()}%`)
    conditions.push(`(u.name ILIKE $${params.length} OR u.id_code ILIKE $${params.length})`)
  }
  if (group.trim() !== "") {
    params.push(group.trim())
    conditions.push(`e.study_group = $${params.length}`)
  }
  const where = `WHERE ${conditions.join(" AND ")}`

  const { rows: countRows } = await db.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count
     FROM enrollments e JOIN users u ON u.id = e.user_id ${where}`,
    params
  )
  const total = Number(countRows[0]?.count ?? 0)

  const limitIdx = params.length + 1
  const offsetIdx = params.length + 2
  const { rows } = await db.query<EnrollmentListRow>(
    `SELECT e.id, e.user_id, u.id_code AS sid, u.title_th AS prefix, u.name,
            e.program, e.study_group, e.year
     FROM enrollments e
     JOIN users u ON u.id = e.user_id
     ${where}
     ORDER BY e.id
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    [...params, pageSize, (page - 1) * pageSize]
  )

  const enrollments: EnrollmentListItem[] = rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    sid: r.sid,
    prefix: r.prefix,
    name: r.name,
    program: r.program,
    studyGroup: r.study_group,
    year: r.year,
  }))

  return { enrollments, total }
}

// Distinct, sorted group values present in a course (nulls excluded) — drives
// the roster's group filter.
export async function listGroups(db: Queryable, courseId: number): Promise<string[]> {
  const { rows } = await db.query<{ study_group: string }>(
    `SELECT DISTINCT study_group
     FROM enrollments
     WHERE course_id = $1::int AND study_group IS NOT NULL
     ORDER BY study_group`,
    [courseId]
  )
  return rows.map((r) => r.study_group)
}
