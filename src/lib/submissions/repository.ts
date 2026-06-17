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

export async function getSubmission(
  db: Queryable,
  id: number
): Promise<SubmissionRecord | null> {
  const { rows } = await db.query<SubmissionRow>(
    `SELECT id, problem_id, user_id, course_id, code, language,
            points_earned, points_max, is_late, results,
            submitted_at, reviewed_at, reviewed_by, manual_score
     FROM submissions
     WHERE id = $1::int`,
    [id]
  )
  return rows[0] ? toRecord(rows[0]) : null
}

export async function reviewSubmission(
  db: Queryable,
  id: number,
  { manualScore, reviewedBy }: { manualScore: number | null; reviewedBy: number }
): Promise<SubmissionRecord | null> {
  const { rows } = await db.query<SubmissionRow>(
    `UPDATE submissions
     SET manual_score = $2, reviewed_by = $3::int, reviewed_at = NOW()
     WHERE id = $1::int
     RETURNING id, problem_id, user_id, course_id, code, language,
               points_earned, points_max, is_late, results,
               submitted_at, reviewed_at, reviewed_by, manual_score`,
    [id, manualScore, reviewedBy]
  )
  return rows[0] ? toRecord(rows[0]) : null
}

export interface SubmissionListItem {
  id: number
  userId: number
  studentName: string
  studentIdCode: string | null
  submittedAt: string
  isLate: boolean
  pointsEarned: number | null
  pointsMax: number | null
  manualScore: number | null
  effectiveScore: number | null
  reviewedAt: string | null
}

interface SubmissionListRow {
  id: number
  user_id: number
  student_name: string
  student_id_code: string | null
  submitted_at: string
  is_late: boolean
  points_earned: string | null
  points_max: string | null
  manual_score: string | null
  reviewed_at: string | null
}

export async function listSubmissionsForProblem(
  db: Queryable,
  problemId: number
): Promise<SubmissionListItem[]> {
  const { rows } = await db.query<SubmissionListRow>(
    `SELECT s.id, s.user_id,
            u.name AS student_name,
            u.id_code AS student_id_code,
            s.submitted_at, s.is_late,
            s.points_earned, s.points_max, s.manual_score, s.reviewed_at
     FROM submissions s
     JOIN users u ON u.id = s.user_id
     WHERE s.problem_id = $1::int
     ORDER BY s.submitted_at DESC`,
    [problemId]
  )
  return rows.map((row) => {
    const pointsEarned = row.points_earned != null ? Number(row.points_earned) : null
    const manualScore = row.manual_score != null ? Number(row.manual_score) : null
    const effectiveScore = manualScore ?? pointsEarned
    return {
      id: row.id,
      userId: row.user_id,
      studentName: row.student_name,
      studentIdCode: row.student_id_code,
      submittedAt: row.submitted_at,
      isLate: row.is_late,
      pointsEarned,
      pointsMax: row.points_max != null ? Number(row.points_max) : null,
      manualScore,
      effectiveScore,
      reviewedAt: row.reviewed_at,
    }
  })
}

export async function getLastSubmission(
  db: Queryable,
  problemId: number,
  userId: number
): Promise<SubmissionRecord | null> {
  const { rows } = await db.query<SubmissionRow>(
    `SELECT id, problem_id, user_id, course_id, code, language,
            points_earned, points_max, is_late, results,
            submitted_at, reviewed_at, reviewed_by, manual_score
     FROM submissions
     WHERE problem_id = $1::int AND user_id = $2::int
     ORDER BY submitted_at DESC
     LIMIT 1`,
    [problemId, userId]
  )
  return rows[0] ? toRecord(rows[0]) : null
}

export interface PendingSubmissionItem {
  id: number
  problemId: number
  problemTitle: string
  weekNo: number
  userId: number
  studentName: string
  studentIdCode: string | null
  submittedAt: string
  isLate: boolean
  pointsEarned: number | null
  pointsMax: number | null
}

interface PendingRow {
  id: number
  problem_id: number
  problem_title: string
  week_no: number
  user_id: number
  student_name: string
  student_id_code: string | null
  submitted_at: string
  is_late: boolean
  points_earned: string | null
  points_max: string | null
}

export async function listPendingSubmissions(
  db: Queryable,
  courseId: number
): Promise<PendingSubmissionItem[]> {
  const { rows } = await db.query<PendingRow>(
    `SELECT s.id, s.problem_id, p.title AS problem_title, w.week_no,
            s.user_id, u.name AS student_name, u.id_code AS student_id_code,
            s.submitted_at, s.is_late, s.points_earned, s.points_max
     FROM submissions s
     JOIN problems p ON p.id = s.problem_id
     JOIN weeks w ON w.id = p.week_id
     JOIN users u ON u.id = s.user_id
     WHERE s.course_id = $1::int AND s.reviewed_at IS NULL
     ORDER BY s.submitted_at ASC`,
    [courseId]
  )
  return rows.map((r) => ({
    id: r.id,
    problemId: r.problem_id,
    problemTitle: r.problem_title,
    weekNo: r.week_no,
    userId: r.user_id,
    studentName: r.student_name,
    studentIdCode: r.student_id_code,
    submittedAt: r.submitted_at,
    isLate: r.is_late,
    pointsEarned: r.points_earned != null ? Number(r.points_earned) : null,
    pointsMax: r.points_max != null ? Number(r.points_max) : null,
  }))
}
