import type { Queryable } from "@/lib/db"
export type { Queryable }

export interface ProblemRecord {
  id: number
  courseId: number
  weekId: number
  title: string
  description: string
  inputSpec: string
  outputSpec: string
  score: number
  dueAt: string | null
  closeAt: string | null
  language: string
  createdAt: string
}

export interface TestCaseInput {
  input: string
  expectedOutput: string
  isHidden: boolean
  sortOrder: number
}

export interface TestCaseRecord extends TestCaseInput {
  id: number
  problemId: number
}

export interface ProblemDetail extends ProblemRecord {
  testCases: TestCaseRecord[]
}

export interface ProblemListItem {
  id: number
  courseId: number
  weekId: number
  weekNo: number
  title: string
  description: string
  score: number
  dueAt: string | null
  closeAt: string | null
}

interface ProblemRow {
  id: number
  course_id: number
  week_id: number
  title: string
  description: string
  input_spec: string
  output_spec: string
  score: number
  due_at: string | null
  close_at: string | null
  language: string
  created_at: string
}

interface TestCaseRow {
  id: number
  problem_id: number
  input: string
  expected_output: string
  is_hidden: boolean
  sort_order: number
}

function toRecord(row: ProblemRow): ProblemRecord {
  return {
    id: row.id,
    courseId: row.course_id,
    weekId: row.week_id,
    title: row.title,
    description: row.description,
    inputSpec: row.input_spec,
    outputSpec: row.output_spec,
    score: row.score,
    dueAt: row.due_at,
    closeAt: row.close_at,
    language: row.language,
    createdAt: row.created_at,
  }
}

function toTestCaseRecord(row: TestCaseRow): TestCaseRecord {
  return {
    id: row.id,
    problemId: row.problem_id,
    input: row.input,
    expectedOutput: row.expected_output,
    isHidden: row.is_hidden,
    sortOrder: row.sort_order,
  }
}

export async function createProblem(
  db: Queryable,
  data: {
    courseId: number
    weekId: number
    title: string
    description?: string
    inputSpec?: string
    outputSpec?: string
    score?: number
    dueAt?: string | null
    closeAt?: string | null
    language?: string
  }
): Promise<ProblemRecord> {
  const { rows } = await db.query<ProblemRow>(
    `INSERT INTO problems
       (course_id, week_id, title, description, input_spec, output_spec, score, due_at, close_at, language)
     VALUES ($1::int, $2::int, $3, $4, $5, $6, $7::int, $8, $9, $10)
     RETURNING id, course_id, week_id, title, description, input_spec, output_spec,
               score, due_at, close_at, language, created_at`,
    [
      data.courseId,
      data.weekId,
      data.title,
      data.description ?? "",
      data.inputSpec ?? "",
      data.outputSpec ?? "",
      data.score ?? 10,
      data.dueAt ?? null,
      data.closeAt ?? null,
      data.language ?? "python",
    ]
  )
  return toRecord(rows[0])
}

export async function getProblemById(
  db: Queryable,
  id: number
): Promise<ProblemDetail | null> {
  const { rows } = await db.query<ProblemRow>(
    `SELECT id, course_id, week_id, title, description, input_spec, output_spec,
            score, due_at, close_at, language, created_at
     FROM problems WHERE id = $1::int`,
    [id]
  )
  if (!rows[0]) return null
  const problem = toRecord(rows[0])
  const { rows: tcRows } = await db.query<TestCaseRow>(
    `SELECT id, problem_id, input, expected_output, is_hidden, sort_order
     FROM test_cases WHERE problem_id = $1::int ORDER BY sort_order, id`,
    [id]
  )
  return { ...problem, testCases: tcRows.map(toTestCaseRecord) }
}

export async function listProblems(
  db: Queryable,
  courseId: number,
  weekId?: number
): Promise<ProblemListItem[]> {
  const params: unknown[] = [courseId]
  const weekFilter = weekId != null ? `AND p.week_id = $2::int` : ""
  if (weekId != null) params.push(weekId)

  const { rows } = await db.query<{
    id: number
    course_id: number
    week_id: number
    week_no: number
    title: string
    description: string
    score: number
    due_at: string | null
    close_at: string | null
  }>(
    `SELECT p.id, p.course_id, p.week_id, w.week_no,
            p.title, p.description, p.score,
            p.due_at, p.close_at
     FROM problems p
     JOIN weeks w ON w.id = p.week_id
     WHERE p.course_id = $1::int ${weekFilter}
     ORDER BY w.week_no, p.id`,
    params
  )
  return rows.map((r) => ({
    id: r.id,
    courseId: r.course_id,
    weekId: r.week_id,
    weekNo: r.week_no,
    title: r.title,
    description: r.description,
    score: r.score,
    dueAt: r.due_at,
    closeAt: r.close_at,
  }))
}

export async function updateProblem(
  db: Queryable,
  id: number,
  data: Partial<{
    title: string
    description: string
    inputSpec: string
    outputSpec: string
    score: number
    dueAt: string | null
    closeAt: string | null
    language: string
  }>
): Promise<ProblemRecord | null> {
  const sets: string[] = []
  const params: unknown[] = []

  if (data.title !== undefined) { params.push(data.title); sets.push(`title = $${params.length}`) }
  if (data.description !== undefined) { params.push(data.description); sets.push(`description = $${params.length}`) }
  if (data.inputSpec !== undefined) { params.push(data.inputSpec); sets.push(`input_spec = $${params.length}`) }
  if (data.outputSpec !== undefined) { params.push(data.outputSpec); sets.push(`output_spec = $${params.length}`) }
  if (data.score !== undefined) { params.push(data.score); sets.push(`score = $${params.length}::int`) }
  if ("dueAt" in data) { params.push(data.dueAt ?? null); sets.push(`due_at = $${params.length}`) }
  if ("closeAt" in data) { params.push(data.closeAt ?? null); sets.push(`close_at = $${params.length}`) }
  if (data.language !== undefined) { params.push(data.language); sets.push(`language = $${params.length}`) }

  if (sets.length === 0) return getProblemById(db, id).then((d) => d ? { ...d } : null)

  params.push(id)
  const { rows } = await db.query<ProblemRow>(
    `UPDATE problems SET ${sets.join(", ")}, updated_at = now()
     WHERE id = $${params.length}::int
     RETURNING id, course_id, week_id, title, description, input_spec, output_spec,
               score, due_at, close_at, language, created_at`,
    params
  )
  return rows[0] ? toRecord(rows[0]) : null
}

export async function deleteProblem(db: Queryable, id: number): Promise<boolean> {
  const { rows } = await db.query<{ id: number }>(
    `DELETE FROM problems WHERE id = $1::int RETURNING id`,
    [id]
  )
  return rows.length > 0
}

export async function setTestCases(
  db: Queryable,
  problemId: number,
  cases: TestCaseInput[]
): Promise<TestCaseRecord[]> {
  await db.query(`DELETE FROM test_cases WHERE problem_id = $1::int`, [problemId])
  if (cases.length === 0) return []
  const result: TestCaseRecord[] = []
  for (const tc of cases) {
    const { rows } = await db.query<TestCaseRow>(
      `INSERT INTO test_cases (problem_id, input, expected_output, is_hidden, sort_order)
       VALUES ($1::int, $2, $3, $4, $5::int)
       RETURNING id, problem_id, input, expected_output, is_hidden, sort_order`,
      [problemId, tc.input, tc.expectedOutput, tc.isHidden, tc.sortOrder]
    )
    result.push(toTestCaseRecord(rows[0]))
  }
  return result
}
