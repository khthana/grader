import type { Queryable } from "@/lib/db"
export type { Queryable }

export interface AssignmentSubmission {
  pointsEarned: number | null
  manualScore: number | null
  effectiveScore: number | null
  isLate: boolean
  submittedAt: string
}

export interface AssignmentItem {
  problemId: number
  title: string
  weekNo: number
  dueAt: string | null
  closeAt: string | null
  pointsMax: number
  submission: AssignmentSubmission | null
}

interface ProblemRow {
  problem_id: number
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
}

export async function getStudentAssignments(
  db: Queryable,
  courseId: number,
  userId: number
): Promise<AssignmentItem[]> {
  const { rows: problemRows } = await db.query<ProblemRow>(
    `SELECT p.id AS problem_id, p.title, w.week_no, p.due_at, p.close_at,
            COALESCE(SUM(tc.score), 0)::text AS points_max
     FROM problems p
     JOIN weeks w ON w.id = p.week_id
     LEFT JOIN test_cases tc ON tc.problem_id = p.id
     WHERE p.course_id = $1::int
     GROUP BY p.id, p.title, w.week_no, p.due_at, p.close_at
     ORDER BY w.week_no, p.id`,
    [courseId]
  )

  if (problemRows.length === 0) return []

  const { rows: subRows } = await db.query<SubmissionRow>(
    `SELECT s.problem_id, s.points_earned, s.manual_score, s.is_late, s.submitted_at
     FROM submissions s
     INNER JOIN (
       SELECT problem_id, MAX(submitted_at) AS last_at
       FROM submissions
       WHERE course_id = $1::int AND user_id = $2::int
       GROUP BY problem_id
     ) latest ON latest.problem_id = s.problem_id
              AND s.submitted_at = latest.last_at
     WHERE s.user_id = $2::int AND s.course_id = $1::int`,
    [courseId, userId]
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
      }
    }
    return {
      problemId: p.problem_id,
      title: p.title,
      weekNo: p.week_no,
      dueAt: p.due_at,
      closeAt: p.close_at,
      pointsMax: Number(p.points_max ?? 0),
      submission,
    }
  })
}
