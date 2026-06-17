export interface Queryable {
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: T[] }>
}

export interface SubmissionInput {
  problemId: number
  userId: number
  courseId: number
  code: string
  language: string
  pointsEarned: number | null
  pointsMax: number | null
  isLate: boolean
  results: unknown
}

export interface SubmissionRecord {
  id: number
  problemId: number
  userId: number
  courseId: number
  code: string
  language: string
  pointsEarned: number | null
  pointsMax: number | null
  isLate: boolean
  results: unknown
  submittedAt: string
  reviewedAt: string | null
  reviewedBy: number | null
  manualScore: number | null
}

interface SubmissionRow {
  id: number
  problem_id: number
  user_id: number
  course_id: number
  code: string
  language: string
  points_earned: string | null
  points_max: string | null
  is_late: boolean
  results: unknown
  submitted_at: string
  reviewed_at: string | null
  reviewed_by: number | null
  manual_score: string | null
}

function toRecord(row: SubmissionRow): SubmissionRecord {
  return {
    id: row.id,
    problemId: row.problem_id,
    userId: row.user_id,
    courseId: row.course_id,
    code: row.code,
    language: row.language,
    pointsEarned: row.points_earned != null ? Number(row.points_earned) : null,
    pointsMax: row.points_max != null ? Number(row.points_max) : null,
    isLate: row.is_late,
    results: row.results,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
    manualScore: row.manual_score != null ? Number(row.manual_score) : null,
  }
}

export async function createSubmission(
  db: Queryable,
  input: SubmissionInput
): Promise<SubmissionRecord> {
  const { rows } = await db.query<SubmissionRow>(
    `INSERT INTO submissions
       (problem_id, user_id, course_id, code, language, points_earned, points_max, is_late, results)
     VALUES ($1::int, $2::int, $3::int, $4, $5, $6, $7, $8, $9::jsonb)
     RETURNING id, problem_id, user_id, course_id, code, language,
               points_earned, points_max, is_late, results,
               submitted_at, reviewed_at, reviewed_by, manual_score`,
    [
      input.problemId,
      input.userId,
      input.courseId,
      input.code,
      input.language,
      input.pointsEarned,
      input.pointsMax,
      input.isLate,
      JSON.stringify(input.results),
    ]
  )
  return toRecord(rows[0])
}

export async function listSubmissions(
  db: Queryable,
  problemId: number
): Promise<SubmissionRecord[]> {
  const { rows } = await db.query<SubmissionRow>(
    `SELECT id, problem_id, user_id, course_id, code, language,
            points_earned, points_max, is_late, results,
            submitted_at, reviewed_at, reviewed_by, manual_score
     FROM submissions
     WHERE problem_id = $1::int
     ORDER BY submitted_at DESC`,
    [problemId]
  )
  return rows.map(toRecord)
}

export async function countSubmitted(
  db: Queryable,
  problemId: number,
  courseId: number
): Promise<number> {
  const { rows } = await db.query<{ count: string }>(
    `SELECT COUNT(DISTINCT s.user_id)::text AS count
     FROM submissions s
     JOIN enrollments e ON e.user_id = s.user_id AND e.course_id = s.course_id
     WHERE s.problem_id = $1::int AND s.course_id = $2::int`,
    [problemId, courseId]
  )
  return Number(rows[0]?.count ?? 0)
}

export async function countPending(
  db: Queryable,
  problemId: number
): Promise<number> {
  const { rows } = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM submissions
     WHERE problem_id = $1::int AND reviewed_at IS NULL`,
    [problemId]
  )
  return Number(rows[0]?.count ?? 0)
}
