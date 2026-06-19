import type { Queryable } from "@/lib/db"
import type { CourseKey } from "@/lib/courses/types"
export type { Queryable, CourseKey }

export interface NewEnrollment {
  courseCode: string
  courseYear: number
  courseSemester: number
  userId: number
  studyGroup?: string | null
  program?: string | null
  year?: string | null
}

export interface EnrollmentRecord {
  courseCode: string
  courseYear: number
  courseSemester: number
  userId: number
  studyGroup: string | null
  program: string | null
  year: string | null
}

export interface EnrollmentListItem {
  userId: number
  sid: string | null
  prefix: string | null
  name: string
  program: string | null
  studyGroup: string | null
  year: string | null
}

export interface ListEnrollmentsParams {
  courseKey: CourseKey
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
  course_code: string
  course_year: number
  course_semester: number
  user_id: number
  study_group: string | null
  program: string | null
  year: string | null
}

function toRecord(row: EnrollmentRow): EnrollmentRecord {
  return {
    courseCode: row.course_code,
    courseYear: row.course_year,
    courseSemester: row.course_semester,
    userId: row.user_id,
    studyGroup: row.study_group,
    program: row.program,
    year: row.year,
  }
}

const RECORD_COLS =
  `course_code, course_year, course_semester, user_id, study_group, program, year`

export async function createEnrollment(
  db: Queryable,
  input: NewEnrollment
): Promise<EnrollmentRecord> {
  const { rows } = await db.query<EnrollmentRow>(
    `INSERT INTO enrollments (course_code, course_year, course_semester, user_id, study_group, program, year)
     VALUES ($1, $2::int, $3::int, $4::int, $5, $6, $7)
     RETURNING ${RECORD_COLS}`,
    [
      input.courseCode,
      input.courseYear,
      input.courseSemester,
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
  key: CourseKey,
  userId: number
): Promise<EnrollmentRecord | null> {
  const { rows } = await db.query<EnrollmentRow>(
    `SELECT ${RECORD_COLS} FROM enrollments
     WHERE course_code = $1 AND course_year = $2::int AND course_semester = $3::int
       AND user_id = $4::int`,
    [key.code, key.year, key.semester, userId]
  )
  return rows[0] ? toRecord(rows[0]) : null
}

export async function getEnrollmentByUser(
  db: Queryable,
  key: CourseKey,
  userId: number
): Promise<EnrollmentRecord | null> {
  return findEnrollment(db, key, userId)
}

export async function deleteEnrollment(
  db: Queryable,
  key: CourseKey,
  userId: number
): Promise<boolean> {
  const { rows } = await db.query<{ user_id: number }>(
    `DELETE FROM enrollments
     WHERE course_code = $1 AND course_year = $2::int AND course_semester = $3::int
       AND user_id = $4::int
     RETURNING user_id`,
    [key.code, key.year, key.semester, userId]
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
  key: CourseKey,
  userId: number,
  input: UpdateEnrollment
): Promise<EnrollmentRecord | null> {
  const { rows } = await db.query<EnrollmentRow>(
    `UPDATE enrollments
     SET study_group = $4, program = $5, year = $6
     WHERE course_code = $1 AND course_year = $2::int AND course_semester = $3::int
       AND user_id = $7::int
     RETURNING ${RECORD_COLS}`,
    [
      key.code,
      key.year,
      key.semester,
      input.studyGroup ?? null,
      input.program ?? null,
      input.year ?? null,
      userId,
    ]
  )
  return rows[0] ? toRecord(rows[0]) : null
}

interface EnrollmentListRow {
  user_id: number
  sid: string | null
  prefix: string | null
  name: string
  program: string | null
  study_group: string | null
  year: string | null
}

const LIST_COLUMNS =
  `e.user_id, u.id_code AS sid, u.title_th AS prefix, u.name, e.program, e.study_group, e.year`

export interface RosterFilter {
  courseKey: CourseKey
  search: string
  group: string
}

function buildRosterFilter({ courseKey, search, group }: RosterFilter): {
  where: string
  params: unknown[]
} {
  const conditions = [
    "e.course_code = $1",
    "e.course_year = $2::int",
    "e.course_semester = $3::int",
  ]
  const params: unknown[] = [courseKey.code, courseKey.year, courseKey.semester]

  if (search.trim() !== "") {
    params.push(`%${search.trim()}%`)
    conditions.push(`(u.name ILIKE $${params.length} OR u.id_code ILIKE $${params.length})`)
  }
  if (group.trim() !== "") {
    params.push(group.trim())
    conditions.push(`e.study_group = $${params.length}`)
  }
  return { where: `WHERE ${conditions.join(" AND ")}`, params }
}

function toListItem(r: EnrollmentListRow): EnrollmentListItem {
  return {
    userId: r.user_id,
    sid: r.sid,
    prefix: r.prefix,
    name: r.name,
    program: r.program,
    studyGroup: r.study_group,
    year: r.year,
  }
}

export async function listEnrollments(
  db: Queryable,
  { courseKey, search, group, page, pageSize }: ListEnrollmentsParams
): Promise<EnrollmentListPage> {
  const { where, params } = buildRosterFilter({ courseKey, search, group })

  const { rows: countRows } = await db.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count
     FROM enrollments e JOIN users u ON u.id = e.user_id ${where}`,
    params
  )
  const total = Number(countRows[0]?.count ?? 0)

  const limitIdx = params.length + 1
  const offsetIdx = params.length + 2
  const { rows } = await db.query<EnrollmentListRow>(
    `SELECT ${LIST_COLUMNS}
     FROM enrollments e
     JOIN users u ON u.id = e.user_id
     ${where}
     ORDER BY u.name
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    [...params, pageSize, (page - 1) * pageSize]
  )

  return { enrollments: rows.map(toListItem), total }
}

export async function listAllEnrollments(
  db: Queryable,
  filter: RosterFilter
): Promise<EnrollmentListItem[]> {
  const { where, params } = buildRosterFilter(filter)
  const { rows } = await db.query<EnrollmentListRow>(
    `SELECT ${LIST_COLUMNS}
     FROM enrollments e
     JOIN users u ON u.id = e.user_id
     ${where}
     ORDER BY u.name`,
    params
  )
  return rows.map(toListItem)
}

export async function listGroups(db: Queryable, key: CourseKey): Promise<string[]> {
  const { rows } = await db.query<{ study_group: string }>(
    `SELECT DISTINCT study_group
     FROM enrollments
     WHERE course_code = $1 AND course_year = $2::int AND course_semester = $3::int
       AND study_group IS NOT NULL
     ORDER BY study_group`,
    [key.code, key.year, key.semester]
  )
  return rows.map((r) => r.study_group)
}
