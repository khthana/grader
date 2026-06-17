export interface Queryable {
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: T[] }>
}

export interface GradebookProblem {
  id: number
  title: string
  weekNo: number
  pointsMax: number
}

export interface GradebookStudent {
  userId: number
  name: string
  idCode: string | null
  scores: Record<number, number | null>
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
}

export async function getGradebook(db: Queryable, courseId: number): Promise<Gradebook> {
  // 1. Problems for this course with their pointsMax
  const { rows: problemRows } = await db.query<ProblemRow>(
    `SELECT p.id, p.title, w.week_no,
            COALESCE(SUM(tc.score), 0)::text AS points_max
     FROM problems p
     JOIN weeks w ON w.id = p.week_id
     LEFT JOIN test_cases tc ON tc.problem_id = p.id
     WHERE p.course_id = $1::int
     GROUP BY p.id, p.title, w.week_no
     ORDER BY w.week_no, p.id`,
    [courseId]
  )

  const problems: GradebookProblem[] = problemRows.map((r) => ({
    id: r.id,
    title: r.title,
    weekNo: r.week_no,
    pointsMax: Number(r.points_max ?? 0),
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
      })),
    }
  }

  // 3. Best effective score per (user, problem): last submission's COALESCE(manual_score, points_earned)
  const { rows: scoreRows } = await db.query<ScoreRow>(
    `SELECT s.user_id, s.problem_id,
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

  // Index scores by userId → problemId → effectiveScore
  const scoreMap = new Map<number, Map<number, number | null>>()
  for (const row of scoreRows) {
    if (!scoreMap.has(row.user_id)) scoreMap.set(row.user_id, new Map())
    const score = row.effective_score != null ? Number(row.effective_score) : null
    scoreMap.get(row.user_id)!.set(row.problem_id, score)
  }

  const students: GradebookStudent[] = studentRows.map((r) => {
    const userScores = scoreMap.get(r.user_id)
    const scores: Record<number, number | null> = {}
    for (const p of problems) {
      scores[p.id] = userScores?.get(p.id) ?? null
    }
    return { userId: r.user_id, name: r.name, idCode: r.id_code, scores }
  })

  return { problems, students }
}
