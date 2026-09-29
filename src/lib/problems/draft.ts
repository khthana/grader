import { validateProblemInput } from "./validation"
import { problemMaxScore } from "./score"
import { toProblemType, type ProblemType } from "./problem-type"
import type { ProblemDetail, TestCaseInput } from "./repository"

// The authoring body a client sends to create or edit a Problem. Untrusted:
// nothing about its shape is assumed until buildProblemDraft has checked it.
export type ProblemBody = Record<string, unknown>

// The exact Problem to write — already validated and normalised.
export interface ProblemDraft {
  weekId: number
  title: string
  description: string
  inputSpec: string
  outputSpec: string
  // The derived max score (#66), not the client's value in io mode.
  score: number
  dueAt: string | null
  closeAt: string | null
  language: string
  problemType: ProblemType
  functionName: string
  starterCode: string
  unitTestCode: string
  blacklist: string[]
  whitelist: string[]
  // Always [] for a unit Problem — unit mode doesn't use Test Cases (#55).
  testCases: TestCaseInput[]
  // Undefined = leave the stored Reference Solution as it is.
  referenceSolution?: string
}

export type ProblemDraftResult =
  | { ok: true; draft: ProblemDraft }
  | { ok: false; errors: Record<string, string> }

type Mergeable = Omit<ProblemDraft, "language" | "referenceSolution">

const NEW_PROBLEM: Omit<Mergeable, "weekId"> = {
  title: "",
  description: "",
  inputSpec: "",
  outputSpec: "",
  score: 10,
  dueAt: null,
  closeAt: null,
  problemType: "io",
  functionName: "",
  starterCode: "",
  unitTestCode: "",
  blacklist: [],
  whitelist: [],
  testCases: [],
}

const TEXT_FIELDS = [
  "title", "description", "inputSpec", "outputSpec", "problemType",
  "functionName", "starterCode", "unitTestCode", "referenceSolution",
] as const
const NUMBER_FIELDS = ["weekId", "score"] as const
const LIST_FIELDS = ["blacklist", "whitelist"] as const
// The only fields where an explicit null means something: "no deadline".
const DEADLINES = ["dueAt", "closeAt"] as const

// Turn an authoring body into the Problem to write (#83). The body is merged
// over the stored Problem on edit (over defaults on create): every omitted —
// or null — field keeps its current value, Problem Type and Test Cases
// included; only a deadline can be cleared, by an explicit null. The *merged*
// Problem is what gets validated and what gets written, so the two can never
// disagree (they did: PUT validated an omitted type as io but saved the stored
// unit type). Language is course-authoritative (#63), the max score is derived
// (#66), and a Problem keeps its Week on edit; the client's values are ignored.
export function buildProblemDraft(
  body: ProblemBody,
  ctx: { language: string; existing?: ProblemDetail }
): ProblemDraftResult {
  const shape = shapeErrors(body)
  if (shape) return { ok: false, errors: shape }

  const base: Partial<Mergeable> = ctx.existing
    ? { ...ctx.existing, testCases: ctx.existing.testCases.map(toTestCaseInput) }
    : NEW_PROBLEM
  const pick = <K extends keyof Mergeable>(key: K): Mergeable[K] => {
    const sent = body[key]
    const set = (DEADLINES as readonly string[]).includes(key) ? sent !== undefined : sent != null
    return (set ? sent : base[key]) as Mergeable[K]
  }

  const merged = {
    weekId: ctx.existing ? ctx.existing.weekId : pick("weekId"),
    title: pick("title").trim(),
    description: pick("description").trim(),
    inputSpec: pick("inputSpec").trim(),
    outputSpec: pick("outputSpec").trim(),
    score: pick("score"),
    dueAt: pick("dueAt"),
    closeAt: pick("closeAt"),
    problemType: body.problemType != null ? toProblemType(body.problemType) : pick("problemType"),
    functionName: pick("functionName"),
    starterCode: pick("starterCode"),
    unitTestCode: pick("unitTestCode"),
    blacklist: pick("blacklist"),
    whitelist: pick("whitelist"),
    testCases: pick("testCases").map(toTestCaseInput),
  }

  const { valid, errors } = validateProblemInput({
    ...merged,
    // Validate against the course language so unit mode is rejected for C (#64).
    language: ctx.language,
  })
  if (!valid) return { ok: false, errors }

  const testCases = merged.problemType === "unit" ? [] : merged.testCases
  return {
    ok: true,
    draft: {
      ...merged,
      testCases,
      score: problemMaxScore({ problemType: merged.problemType, score: merged.score, testCases }),
      language: ctx.language,
      referenceSolution: typeof body.referenceSolution === "string" ? body.referenceSolution : undefined,
    },
  }
}

// A Test Case as written — the stored record minus its ids. Shared with course
// duplication, which copies stored Test Cases 1:1.
export function toTestCaseInput(tc: TestCaseInput): TestCaseInput {
  return {
    input: tc.input,
    expectedOutput: tc.expectedOutput,
    isHidden: tc.isHidden,
    score: tc.score,
    sortOrder: tc.sortOrder,
  }
}

// Wrong-typed fields are a 400, never a crash further down (a 500).
function shapeErrors(body: ProblemBody): Record<string, string> | null {
  const errors: Record<string, string> = {}
  for (const key of TEXT_FIELDS) {
    if (body[key] != null && typeof body[key] !== "string") errors[key] = `${key} ต้องเป็นข้อความ`
  }
  for (const key of NUMBER_FIELDS) {
    if (body[key] != null && !Number.isFinite(body[key])) errors[key] = `${key} ต้องเป็นตัวเลข`
  }
  for (const key of DEADLINES) {
    if (body[key] != null && typeof body[key] !== "string") errors[key] = `${key} ต้องเป็นวันเวลา`
  }
  for (const key of LIST_FIELDS) {
    if (body[key] != null && !Array.isArray(body[key])) errors[key] = `${key} ต้องเป็นรายการ`
  }
  const cases = body.testCases
  if (
    cases != null &&
    (!Array.isArray(cases) ||
      !cases.every(
        (tc) =>
          tc != null &&
          typeof tc === "object" &&
          typeof tc.input === "string" &&
          typeof tc.expectedOutput === "string"
      ))
  ) {
    errors.testCases = "test case ต้องมี input และ expectedOutput เป็นข้อความ"
  }
  return Object.keys(errors).length > 0 ? errors : null
}
