import type { Queryable } from "@/lib/db"
import type { CourseKey } from "@/lib/courses/types"
export type { Queryable, CourseKey }

export interface AssignmentSubmission {
  pointsEarned: number | null
  manualScore: number | null
  effectiveScore: number | null
  isLate: boolean
  submittedAt: string
  reviewedAt: string | null
}

export interface AssignmentItem {
  problemId: number
  problemNo: number
  title: string
  weekNo: number
  dueAt: string | null
  closeAt: string | null
  pointsMax: number
  submission: AssignmentSubmission | null
}

interface ProblemRow {
  problem_id: number
  problem_no: number
  title: string
  week_no: number
  due_at: string | null
  close_at: string | null
  points_max: string | null
}

interface SubmissionRow {
  problem_id: number
  points_earned: string | null
  manual_score: string | null
  is_late: boolean
  submitted_at: string
  reviewed_at: string | null
}

export async function getStudentAssignments(
  db: Queryable,
  key: CourseKey,
  userId: number
): Promise<AssignmentItem[]> {
  const { rows: problemRows } = await db.query<ProblemRow>(
    `SELECT p.id AS problem_id, p.problem_no, p.title, w.week_no, p.due_at, p.close_at,
            p.score::text AS points_max
     FROM problems p
     JOIN weeks w ON w.id = p.week_id
     WHERE p.course_code = $1 AND p.course_year = $2::int AND p.course_semester = $3::int
     ORDER BY w.week_no, p.problem_no`,
    [key.code, key.year, key.semester]
  )

  if (problemRows.length === 0) return []

  const { rows: subRows } = await db.query<SubmissionRow>(
    `SELECT s.problem_id, s.points_earned, s.manual_score, s.is_late, s.submitted_at, s.reviewed_at
     FROM submissions s
     INNER JOIN (
       SELECT problem_id, MAX(submitted_at) AS last_at
       FROM submissions
       WHERE course_code = $1 AND course_year = $2::int AND course_semester = $3::int
         AND user_id = $4::int
       GROUP BY problem_id
     ) latest ON latest.problem_id = s.problem_id
              AND s.submitted_at = latest.last_at
     WHERE s.user_id = $4::int
       AND s.course_code = $1 AND s.course_year = $2::int AND s.course_semester = $3::int`,
    [key.code, key.year, key.semester, userId]
  )

  const subMap = new Map<number, SubmissionRow>()
  for (const row of subRows) {
    subMap.set(row.problem_id, row)
  }

  return problemRows.map((p) => {
    const sub = subMap.get(p.problem_id) ?? null
    let submission: AssignmentSubmission | null = null
    if (sub) {
      const pointsEarned = sub.points_earned != null ? Number(sub.points_earned) : null
      const manualScore = sub.manual_score != null ? Number(sub.manual_score) : null
      submission = {
        pointsEarned,
        manualScore,
        effectiveScore: manualScore ?? pointsEarned,
        isLate: sub.is_late,
        submittedAt: sub.submitted_at,
        reviewedAt: sub.reviewed_at,
      }
    }
    return {
      problemId: p.problem_id,
      problemNo: p.problem_no,
      title: p.title,
      weekNo: p.week_no,
      dueAt: p.due_at,
      closeAt: p.close_at,
      pointsMax: Number(p.points_max ?? 0),
      submission,
    }
  })
}
