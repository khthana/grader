import { describe, it, expect } from "vitest"
import { gradeSubmission, type CodeRunner, type GradableProblem } from "./index"
import type { TestResult } from "@/types"

// A fake CodeRunner — the second adapter that earns the seam. Grading is
// tested with no network and no module mocking; we script the runner's output.
function fakeRunner(opts: {
  testCases?: (cases: { id: number }[]) => TestResult[]
  unit?: TestResult
}): CodeRunner {
  return {
    async runTestCases(_code, cases) {
      return opts.testCases ? opts.testCases(cases) : []
    },
    async runUnitTestBlock() {
      return (
        opts.unit ?? {
          testCaseId: 0,
          passed: true,
          actualOutput: "",
          expectedOutput: "",
          executionTime: 0,
        }
      )
    },
  }
}

function ioProblem(over: Partial<GradableProblem> = {}): GradableProblem {
  return {
    problemType: "io",
    language: "python",
    score: 30,
    unitTestCode: "",
    blacklist: [],
    whitelist: [],
    testCases: [
      { id: 1, input: "", expectedOutput: "A", isHidden: false, score: 20 },
      { id: 2, input: "", expectedOutput: "B", isHidden: true, score: 10 },
    ],
    ...over,
  }
}

const pass = (id: number, expected: string): TestResult => ({
  testCaseId: id,
  passed: true,
  actualOutput: expected,
  expectedOutput: expected,
  executionTime: 0,
})
const fail = (id: number, expected: string): TestResult => ({
  testCaseId: id,
  passed: false,
  actualOutput: "x",
  expectedOutput: expected,
  executionTime: 0,
})

describe("gradeSubmission", () => {
  it("io run mode: only visible cases run; pointsMax = visible scores", async () => {
    const runner = fakeRunner({ testCases: () => [pass(1, "A")] })
    const result = await gradeSubmission(ioProblem(), "print('A')", "run", runner)
    expect(result.pointsEarned).toBe(20)
    expect(result.pointsMax).toBe(20)
    expect(result.results).toHaveLength(1)
  })

  it("io run mode passes the visible case shaped {id,input,expectedOutput,isHidden}", async () => {
    let seen: { id: number; isHidden: boolean }[] = []
    const runner = fakeRunner({
      testCases: (cases) => {
        seen = cases as { id: number; isHidden: boolean }[]
        return [pass(1, "A")]
      },
    })
    await gradeSubmission(ioProblem(), "print('A')", "run", runner)
    expect(seen).toHaveLength(1)
    expect(seen[0].isHidden).toBe(false)
  })

  it("io submit mode: all cases run; per-case scoring sums passing cases", async () => {
    const runner = fakeRunner({ testCases: () => [pass(1, "A"), fail(2, "B")] })
    const result = await gradeSubmission(ioProblem(), "print('A')", "submit", runner)
    expect(result.pointsEarned).toBe(20)
    expect(result.pointsMax).toBe(30)
  })

  it("io test-case score defaults to 10 when unset", async () => {
    const problem = ioProblem({
      testCases: [{ id: 1, input: "", expectedOutput: "A", isHidden: false }],
    })
    const runner = fakeRunner({ testCases: () => [pass(1, "A")] })
    const result = await gradeSubmission(problem, "print('A')", "run", runner)
    expect(result.pointsEarned).toBe(10)
    expect(result.pointsMax).toBe(10)
  })

  it("unit mode pass: all-or-nothing pointsEarned = problem.score", async () => {
    const problem = ioProblem({ problemType: "unit", score: 25, unitTestCode: "assert add(1,2)==3" })
    const runner = fakeRunner({
      unit: { testCaseId: 0, passed: true, actualOutput: "", expectedOutput: "", executionTime: 0 },
    })
    const result = await gradeSubmission(problem, "def add(a,b): return a+b", "run", runner)
    expect(result.pointsEarned).toBe(25)
    expect(result.pointsMax).toBe(25)
  })

  it("unit mode fail: pointsEarned = 0, traceback preserved", async () => {
    const problem = ioProblem({ problemType: "unit", score: 25, unitTestCode: "assert add(1,2)==3" })
    const runner = fakeRunner({
      unit: { testCaseId: 0, passed: false, actualOutput: "", expectedOutput: "", executionTime: 0, error: "AssertionError" },
    })
    const result = await gradeSubmission(problem, "def add(a,b): return 99", "run", runner)
    expect(result.pointsEarned).toBe(0)
    expect(result.results[0].error).toContain("AssertionError")
  })

  it("blacklist violation: scores zero without running code; io pointsMax = all cases", async () => {
    let ran = false
    const runner = fakeRunner({ testCases: () => { ran = true; return [] } })
    const problem = ioProblem({ blacklist: ["sorted"] })
    const result = await gradeSubmission(problem, "x = sorted(lst)", "run", runner)
    expect(result.pointsEarned).toBe(0)
    expect(result.pointsMax).toBe(30) // all cases, not just visible
    expect(result.feedback).toContain("ละเมิดนโยบาย")
    expect(ran).toBe(false)
  })

  it("whitelist violation in unit mode: pointsMax = problem.score, code not run", async () => {
    let ran = false
    const problem = ioProblem({ problemType: "unit", score: 25, whitelist: ["def"] })
    const runner: CodeRunner = {
      async runTestCases() { return [] },
      async runUnitTestBlock() { ran = true; return { testCaseId: 0, passed: true, actualOutput: "", expectedOutput: "", executionTime: 0 } },
    }
    const result = await gradeSubmission(problem, "x = 1 + 1", "run", runner)
    expect(result.pointsEarned).toBe(0)
    expect(result.pointsMax).toBe(25)
    expect(ran).toBe(false)
  })

  it("io mode passes the problem's language through to the runner", async () => {
    let seenLanguage: string | undefined
    const runner: CodeRunner = {
      async runTestCases(_code, _cases, language) {
        seenLanguage = language
        return [pass(1, "A")]
      },
      async runUnitTestBlock() {
        return { testCaseId: 0, passed: true, actualOutput: "", expectedOutput: "", executionTime: 0 }
      },
    }
    await gradeSubmission(ioProblem({ language: "c" }), "int main(){}", "submit", runner)
    expect(seenLanguage).toBe("c")
  })

  it("all visible pass → 'ผ่านทุก test case!' feedback", async () => {
    const runner = fakeRunner({ testCases: () => [pass(1, "A")] })
    const result = await gradeSubmission(ioProblem(), "print('A')", "run", runner)
    expect(result.feedback).toBe("ผ่านทุก test case!")
  })
})
