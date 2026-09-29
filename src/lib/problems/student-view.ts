import { PROGRAM_RESULT_ID, type GradeResult, type TestResult } from "@/types"
import type { ProblemType } from "./problem-type"

// Student View (#84): the one place that decides what a viewer may see of a
// Problem or a GradeResult. Staff (of this course) see everything raw; a
// Student never sees a hidden Test Case (#71, PRD.md #22), the Unit Test Code
// (the grader's answer key), or anything of a unit run (#79). Callers pass the
// viewer's course access and never branch on `staff` to redact.

export interface Viewer {
  staff: boolean
}

interface ViewableProblem {
  problemType: ProblemType
  unitTestCode: string
  testCases: Array<{ id: number; isHidden: boolean }>
}

// `unitTestCode` is present for staff only.
export type ProblemView<T extends ViewableProblem> = Omit<T, "unitTestCode"> &
  Partial<Pick<T, "unitTestCode">>

// The Test Cases shown on the problem page as samples — to every viewer; staff
// see the hidden ones in the editor.
export function sampleTestCases<C extends { isHidden: boolean }>(problem: { testCases: C[] }): C[] {
  return problem.testCases.filter((tc) => !tc.isHidden)
}

export function problemFor<T extends ViewableProblem>(viewer: Viewer, problem: T): ProblemView<T> {
  if (viewer.staff) return problem
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { unitTestCode, ...rest } = problem
  return { ...rest, testCases: sampleTestCases(problem) }
}

// A Student's GradeResult keeps scores, feedback and every pass/fail; what a
// result may show beyond that depends on where it came from:
//  - a visible io case: everything.
//  - the io compile failure: the gcc error (the student's own code) — never output.
//  - anything else — a hidden case, the unit block, an unknown id: pass/fail only.
//    Any output could leak the hidden input or answer (a program can echo stdin
//    to stderr); unit code shares the file with the tests, so it can print them.
// The stored Submission keeps the full results for staff.
export function gradeResultFor(
  viewer: Viewer,
  result: GradeResult,
  problem: Pick<ViewableProblem, "problemType" | "testCases">
): GradeResult {
  if (viewer.staff) return result
  const isUnit = problem.problemType === "unit"
  const shown = new Set(isUnit ? [] : sampleTestCases(problem).map((tc) => tc.id))
  const view = (r: TestResult): TestResult => {
    if (shown.has(r.testCaseId)) return r
    if (!isUnit && r.testCaseId === PROGRAM_RESULT_ID) {
      return { ...r, expectedOutput: "", actualOutput: "" }
    }
    return {
      testCaseId: r.testCaseId,
      passed: r.passed,
      executionTime: r.executionTime,
      expectedOutput: "",
      actualOutput: "",
      hidden: true,
    }
  }
  return { ...result, results: result.results.map(view) }
}
