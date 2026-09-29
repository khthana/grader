import { describe, it, expect } from "vitest"
import { gradeResultFor, problemFor, sampleTestCases } from "./student-view"
import type { GradeResult, TestResult } from "@/types"

// #84 — one suite for every "staff sees raw / student sees redacted" decision:
// staff/student × io/unit × hidden/visible, for both a Problem and a GradeResult.

const STAFF = { staff: true }
const STUDENT = { staff: false }

const visibleCase = { id: 1, input: "1", expectedOutput: "a", isHidden: false }
const hiddenCase = { id: 2, input: "2", expectedOutput: "b", isHidden: true }

function problem(problemType: "io" | "unit") {
  return {
    id: 7,
    title: "T",
    problemType,
    unitTestCode: problemType === "unit" ? "assert add(1, 2) == 3" : "",
    testCases: problemType === "io" ? [visibleCase, hiddenCase] : [],
  }
}

function res(testCaseId: number, over: Partial<TestResult> = {}): TestResult {
  return {
    testCaseId,
    passed: false,
    actualOutput: "leak",
    expectedOutput: "ans",
    executionTime: 4,
    error: "boom",
    ...over,
  }
}

function graded(results: TestResult[]): GradeResult {
  return { pointsEarned: 10, pointsMax: 20, totalTests: results.length, passedTests: 1, results, feedback: "f" }
}

// A withheld result keeps pass/fail only.
const withheld = (r: TestResult) => ({
  testCaseId: r.testCaseId,
  passed: r.passed,
  executionTime: r.executionTime,
  expectedOutput: "",
  actualOutput: "",
  hidden: true,
})

describe("problemFor", () => {
  it.each([
    ["staff", "io", STAFF, [visibleCase, hiddenCase], true],
    ["staff", "unit", STAFF, [], true],
    ["student", "io", STUDENT, [visibleCase], false],
    ["student", "unit", STUDENT, [], false],
  ] as const)("%s × %s", (_who, type, viewer, cases, seesUnitCode) => {
    const p = problem(type)
    const view = problemFor(viewer, p)
    expect(view.testCases).toEqual(cases)
    expect("unitTestCode" in view).toBe(seesUnitCode)
    expect(view).toMatchObject({ id: 7, title: "T", problemType: type })
  })

  it("staff get the Problem untouched", () => {
    const p = problem("io")
    expect(problemFor(STAFF, p)).toBe(p)
  })
})

describe("sampleTestCases", () => {
  it("the cases shown on the problem page are the visible ones, for every viewer", () => {
    expect(sampleTestCases(problem("io"))).toEqual([visibleCase])
  })
})

describe("gradeResultFor", () => {
  const visible = res(1)
  const hidden = res(2)
  const unit = res(0, { actualOutput: "assert add(1, 2) == 3", error: "Traceback ... assert add(1, 2) == 3" })

  it.each([
    ["staff", "io", "visible", STAFF, visible, visible],
    ["staff", "io", "hidden", STAFF, hidden, hidden],
    ["staff", "unit", "block", STAFF, unit, unit],
    ["student", "io", "visible", STUDENT, visible, visible],
    ["student", "io", "hidden (#71)", STUDENT, hidden, withheld(hidden)],
    // Student code shares the file with the Unit Test Code — it can print or
    // raise the block, so nothing of the run is safe to show (#79).
    ["student", "unit", "block (#79)", STUDENT, unit, withheld(unit)],
  ] as const)("%s × %s × %s", (_who, type, _case, viewer, input, expected) => {
    const out = gradeResultFor(viewer, graded([input]), problem(type))
    expect(out.results).toEqual([expected])
    expect(out).toMatchObject({ pointsEarned: 10, pointsMax: 20, passedTests: 1, feedback: "f" })
  })

  it("student × io × compile failure: keeps the gcc error (their own code), blanks any output", () => {
    const compile = res(0, { error: "main.c:1: error: expected ';'", errored: true })
    const out = gradeResultFor(STUDENT, graded([compile]), problem("io"))
    expect(out.results).toEqual([
      { ...compile, expectedOutput: "", actualOutput: "" },
    ])
  })

  it("student × io × an id that is no visible case is withheld (fails closed)", () => {
    const stray = res(99)
    expect(gradeResultFor(STUDENT, graded([stray]), problem("io")).results).toEqual([withheld(stray)])
  })

  it("staff get the GradeResult untouched", () => {
    const g = graded([hidden])
    expect(gradeResultFor(STAFF, g, problem("io"))).toBe(g)
  })
})
