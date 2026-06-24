import type { Queryable } from "@/lib/db"
import type { CourseKey } from "@/lib/courses/types"
import { canManageCourses } from "@/lib/courses/access"
export type { Queryable, CourseKey }

export interface ProblemRecord {
  id: number
  courseCode: string
  courseYear: number
  courseSemester: number
  weekId: number
  problemNo: number
  title: string
  description: string
  inputSpec: string
  outputSpec: string
  score: number
  dueAt: string | null
  closeAt: string | null
  language: string
  problemType: string
  functionName: string
  starterCode: string
  unitTestCode: string
  blacklist: string[]
  whitelist: string[]
  createdAt: string
}

export interface TestCaseInput {
  input: string
  expectedOutput: string
  isHidden: boolean
  score?: number
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
  courseCode: string
  courseYear: number
  courseSemester: number
  weekId: number
  weekNo: number
  problemNo: number
  title: string
  description: string
  score: number
  dueAt: string | null
  closeAt: string | null
}

interface ProblemRow {
  id: number
  course_code: string
  course_year: number
  course_semester: number
  week_id: number
  problem_no: number
  title: string
  description: string
  input_spec: string
  output_spec: string
  score: number
  due_at: string | null
  close_at: string | null
  language: string
  problem_type: string
  function_name: string
  starter_code: string
  unit_test_code: string
  blacklist: string[]
  whitelist: string[]
  created_at: string
}

interface TestCaseRow {
  id: number
  problem_id: number
  input: string
  expected_output: string
  is_hidden: boolean
  score: number
  sort_order: number
}

function toRecord(row: ProblemRow): ProblemRecord {
  return {
    id: row.id,
    courseCode: row.course_code,
    courseYear: row.course_year,
    courseSemester: row.course_semester,
    weekId: row.week_id,
    problemNo: row.problem_no,
    title: row.title,
    description: row.description,
    inputSpec: row.input_spec,
    outputSpec: row.output_spec,
    score: row.score,
    dueAt: row.due_at,
    closeAt: row.close_at,
    language: row.language,
    problemType: row.problem_type,
    functionName: row.function_name,
    starterCode: row.starter_code,
    unitTestCode: row.unit_test_code,
    blacklist: row.blacklist ?? [],
    whitelist: row.whitelist ?? [],
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
    score: row.score,
    sortOrder: row.sort_order,
  }
}

const PROBLEM_COLS =
  `id, course_code, course_year, course_semester, week_id, problem_no,
   title, description, input_spec, output_spec, score, due_at, close_at, language,
   problem_type, function_name, starter_code, unit_test_code, blacklist, whitelist, created_at`

export async function createProblem(
  db: Queryable,
  data: {
    courseCode: string
    courseYear: number
    courseSemester: number
    weekId: number
    title: string
    description?: string
    inputSpec?: string
    outputSpec?: string
    score?: number
    dueAt?: string | null
    closeAt?: string | null
    language?: string
    referenceSolution?: string
    problemType?: string
    functionName?: string
    starterCode?: string
    unitTestCode?: string
    blacklist?: string[]
    whitelist?: string[]
  }
): Promise<ProblemRecord> {
  const { rows } = await db.query<ProblemRow>(
    `INSERT INTO problems
       (course_code, course_year, course_semester, week_id, problem_no,
        title, description, input_spec, output_spec, score, due_at, close_at, language,
        reference_solution, problem_type, function_name, starter_code, unit_test_code, blacklist, whitelist)
     VALUES ($1, $2::int, $3::int, $4::int,
             COALESCE((SELECT MAX(problem_no) FROM problems WHERE week_id = $4::int), 0) + 1,
             $5, $6, $7, $8, $9::int, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
     RETURNING ${PROBLEM_COLS}`,
    [
      data.courseCode,
      data.courseYear,
      data.courseSemester,
      data.weekId,
      data.title,
      data.description ?? "",
      data.inputSpec ?? "",
      data.outputSpec ?? "",
      data.score ?? 10,
      data.dueAt ?? null,
      data.closeAt ?? null,
      data.language ?? "python",
      data.referenceSolution ?? "",
      data.problemType ?? "io",
      data.functionName ?? "",
      data.starterCode ?? "",
      data.unitTestCode ?? "",
      data.blacklist ?? [],
      data.whitelist ?? [],
    ]
  )
  return toRecord(rows[0])
}

// Raw read of the Reference Solution. Auth-free like every other repository
// function — the staff gate lives at the caller. For request- or page-driven
// reads use getReferenceSolutionForStaff so the gate can't be forgotten; this
// raw read is only for trusted server-side orchestration that is already
// authorized (e.g. course duplication inside a manage:true route).
export async function getReferenceSolution(
  db: Queryable,
  problemId: number
): Promise<string> {
  const { rows } = await db.query<{ reference_solution: string }>(
    `SELECT reference_solution FROM problems WHERE id = $1::int`,
    [problemId]
  )
  return rows[0]?.reference_solution ?? ""
}

export type ReferenceSolutionResult =
  | { ok: true; solution: string }
  | { ok: false; reason: "forbidden" }

// Staff-only read of the Reference Solution: the gate rides the read. A caller
// whose roles can't manage courses gets "forbidden", never the value — so the
// invariant (CONTEXT.md: "never exposed to Students") is enforced by shape, not
// by each caller remembering to gate. This is the entry every request/page
// path should use to reach the Reference Solution.
export async function getReferenceSolutionForStaff(
  db: Queryable,
  problemId: number,
  roles: string[]
): Promise<ReferenceSolutionResult> {
  if (!canManageCourses(roles)) return { ok: false, reason: "forbidden" }
  return { ok: true, solution: await getReferenceSolution(db, problemId) }
}

export async function getProblemById(
  db: Queryable,
  id: number
): Promise<ProblemDetail | null> {
  const { rows } = await db.query<ProblemRow>(
    `SELECT ${PROBLEM_COLS} FROM problems WHERE id = $1::int`,
    [id]
  )
  if (!rows[0]) return null
  const problem = toRecord(rows[0])
  const { rows: tcRows } = await db.query<TestCaseRow>(
    `SELECT id, problem_id, input, expected_output, is_hidden, score, sort_order
     FROM test_cases WHERE problem_id = $1::int ORDER BY sort_order, id`,
    [id]
  )
  return { ...problem, testCases: tcRows.map(toTestCaseRecord) }
}

// Course-scoped read: returns the problem only when it belongs to `key`,
// otherwise null. Folds the CourseKey ownership check into the query so staff
// handlers can't accidentally read across courses (replaces getProblemById +
// hand-written ownsProblem comparisons).
export async function getProblemForCourse(
  db: Queryable,
  key: CourseKey,
  id: number
): Promise<ProblemDetail | null> {
  const { rows } = await db.query<{ id: number }>(
    `SELECT id FROM problems
     WHERE id = $1::int AND course_code = $2
       AND course_year = $3::int AND course_semester = $4::int`,
    [id, key.code, key.year, key.semester]
  )
  if (!rows[0]) return null
  return getProblemById(db, id)
}

// Look up a problem by its human-readable URL coordinates (weekId + problemNo).
export async function getProblemByWeekAndNo(
  db: Queryable,
  weekId: number,
  problemNo: number
): Promise<ProblemDetail | null> {
  const { rows } = await db.query<ProblemRow>(
    `SELECT ${PROBLEM_COLS} FROM problems
     WHERE week_id = $1::int AND problem_no = $2::int`,
    [weekId, problemNo]
  )
  if (!rows[0]) return null
  return getProblemById(db, rows[0].id)
}

export async function listProblems(
  db: Queryable,
  key: CourseKey,
  weekId?: number
): Promise<ProblemListItem[]> {
  const params: unknown[] = [key.code, key.year, key.semester]
  const weekFilter = weekId != null ? `AND p.week_id = $4::int` : ""
  if (weekId != null) params.push(weekId)

  const { rows } = await db.query<{
    id: number
    course_code: string
    course_year: number
    course_semester: number
    week_id: number
    week_no: number
    problem_no: number
    title: string
    description: string
    score: number
    due_at: string | null
    close_at: string | null
  }>(
    `SELECT p.id, p.course_code, p.course_year, p.course_semester,
            p.week_id, w.week_no, p.problem_no,
            p.title, p.description, p.score,
            p.due_at, p.close_at
     FROM problems p
     JOIN weeks w ON w.id = p.week_id
     WHERE p.course_code = $1 AND p.course_year = $2::int AND p.course_semester = $3::int
     ${weekFilter}
     ORDER BY w.week_no, p.problem_no`,
    params
  )
  return rows.map((r) => ({
    id: r.id,
    courseCode: r.course_code,
    courseYear: r.course_year,
    courseSemester: r.course_semester,
    weekId: r.week_id,
    weekNo: r.week_no,
    problemNo: r.problem_no,
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
    referenceSolution: string
    problemType: string
    functionName: string
    starterCode: string
    unitTestCode: string
    blacklist: string[]
    whitelist: string[]
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
  if (data.referenceSolution !== undefined) { params.push(data.referenceSolution); sets.push(`reference_solution = $${params.length}`) }
  if (data.problemType !== undefined) { params.push(data.problemType); sets.push(`problem_type = $${params.length}`) }
  if (data.functionName !== undefined) { params.push(data.functionName); sets.push(`function_name = $${params.length}`) }
  if (data.starterCode !== undefined) { params.push(data.starterCode); sets.push(`starter_code = $${params.length}`) }
  if (data.unitTestCode !== undefined) { params.push(data.unitTestCode); sets.push(`unit_test_code = $${params.length}`) }
  if (data.blacklist !== undefined) { params.push(data.blacklist); sets.push(`blacklist = $${params.length}`) }
  if (data.whitelist !== undefined) { params.push(data.whitelist); sets.push(`whitelist = $${params.length}`) }

  if (sets.length === 0) return getProblemById(db, id).then((d) => (d ? { ...d } : null))

  params.push(id)
  const { rows } = await db.query<ProblemRow>(
    `UPDATE problems SET ${sets.join(", ")}, updated_at = now()
     WHERE id = $${params.length}::int
     RETURNING ${PROBLEM_COLS}`,
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
      `INSERT INTO test_cases (problem_id, input, expected_output, is_hidden, score, sort_order)
       VALUES ($1::int, $2, $3, $4, $5::int, $6::int)
       RETURNING id, problem_id, input, expected_output, is_hidden, score, sort_order`,
      [problemId, tc.input, tc.expectedOutput, tc.isHidden, tc.score ?? 10, tc.sortOrder]
    )
    result.push(toTestCaseRecord(rows[0]))
  }
  return result
}
