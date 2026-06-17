export interface Queryable {
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: T[] }>
}

import { deriveScorebookStatus, type ScorebookStatus } from "./status"

export interface GradebookProblem {
  id: number
  title: string
  weekNo: number
  pointsMax: number
  dueAt: string | null
}

export interface GradebookStudent {
  userId: number
  name: string
  idCode: string | null
  scores: Record<number, number | null>
  status: ScorebookStatus
}

export interface Gradebook {
  problems: GradebookProblem[]
  students: GradebookStudent[]
}

interface ProblemRow {
  id: number
  title: string
  week_no: number
  points_max: string | null
  due_at: string | Date | null
}

interface StudentRow {
  user_id: number
  name: string
  id_code: string | null
}

interface ScoreRow {
  user_id: number
  problem_id: number
  effective_score: string | null
  is_late: boolean
}

export async function getGradebook(db: Queryable, courseId: number): Promise<Gradebook> {
  // 1. Problems for this course with their pointsMax
  const now = new Date()

  const { rows: problemRows } = await db.query<ProblemRow>(
    `SELECT p.id, p.title, w.week_no, p.due_at,
            COALESCE(SUM(tc.score), 0)::text AS points_max
     FROM problems p
     JOIN weeks w ON w.id = p.week_id
     LEFT JOIN test_cases tc ON tc.problem_id = p.id
     WHERE p.course_id = $1::int
     GROUP BY p.id, p.title, w.week_no, p.due_at
     ORDER BY w.week_no, p.id`,
    [courseId]
  )

  const problems: GradebookProblem[] = problemRows.map((r) => ({
    id: r.id,
    title: r.title,
    weekNo: r.week_no,
    pointsMax: Number(r.points_max ?? 0),
    dueAt: r.due_at == null ? null : new Date(r.due_at).toISOString(),
  }))

  // 2. Enrolled students
  const { rows: studentRows } = await db.query<StudentRow>(
    `SELECT u.id AS user_id, u.name, u.id_code
     FROM enrollments e
     JOIN users u ON u.id = e.user_id
     WHERE e.course_id = $1::int
     ORDER BY u.name`,
    [courseId]
  )

  if (problemRows.length === 0 || studentRows.length === 0) {
    return {
      problems,
      students: studentRows.map((r) => ({
        userId: r.user_id,
        name: r.name,
        idCode: r.id_code,
        scores: {},
        // No problems means nothing can be due, late, or missing.
        status: "none-due" as ScorebookStatus,
      })),
    }
  }

  // 3. Best effective score per (user, problem): last submission's COALESCE(manual_score, points_earned)
  const { rows: scoreRows } = await db.query<ScoreRow>(
    `SELECT s.user_id, s.problem_id, s.is_late,
            COALESCE(s.manual_score, s.points_earned)::text AS effective_score
     FROM submissions s
     INNER JOIN (
       SELECT user_id, problem_id, MAX(submitted_at) AS last_at
       FROM submissions
       WHERE course_id = $1::int
       GROUP BY user_id, problem_id
     ) latest ON latest.user_id = s.user_id
               AND latest.problem_id = s.problem_id
               AND s.submitted_at = latest.last_at
     WHERE s.course_id = $1::int`,
    [courseId]
  )

  // Index scores by userId → problemId → effectiveScore, and lateness by userId → problemId.
  const scoreMap = new Map<number, Map<number, number | null>>()
  const lateMap = new Map<number, Record<number, boolean>>()
  for (const row of scoreRows) {
    if (!scoreMap.has(row.user_id)) scoreMap.set(row.user_id, new Map())
    const score = row.effective_score != null ? Number(row.effective_score) : null
    scoreMap.get(row.user_id)!.set(row.problem_id, score)

    if (!lateMap.has(row.user_id)) lateMap.set(row.user_id, {})
    lateMap.get(row.user_id)![row.problem_id] = row.is_late
  }

  const statusProblems = problems.map((p) => ({ id: p.id, dueAt: p.dueAt }))

  const students: GradebookStudent[] = studentRows.map((r) => {
    const userScores = scoreMap.get(r.user_id)
    const scores: Record<number, number | null> = {}
    for (const p of problems) {
      scores[p.id] = userScores?.get(p.id) ?? null
    }
    const status = deriveScorebookStatus({
      problems: statusProblems,
      scores,
      lateByProblem: lateMap.get(r.user_id) ?? {},
      now,
    })
    return { userId: r.user_id, name: r.name, idCode: r.id_code, scores, status }
  })

  return { problems, students }
}
