// #85 — Reference verification ("รันเฉลย") runs through the same CodeRunner as
// grading, so the editor's ✅/⚠️/🔴 can't disagree with how students are graded.
import { describe, it, expect, vi, afterEach } from "vitest"
import {
  gradeSubmission,
  pistonRunner,
  verifyReferenceSolution,
  type CodeRunner,
  type GradableProblem,
} from "./index"
import type { TestResult } from "@/types"

function result(over: Partial<TestResult>): TestResult {
  return { testCaseId: 1, passed: false, actualOutput: "", expectedOutput: "", executionTime: 0, ...over }
}

function fakeRunner(opts: { testCases?: TestResult[]; unit?: TestResult }): CodeRunner & {
  calls: { cases: unknown[]; language: string }[]
} {
  const calls: { cases: unknown[]; language: string }[] = []
  return {
    calls,
    async runTestCases(_code, cases, language) {
      calls.push({ cases, language })
      return opts.testCases ?? []
    },
    async runUnitTestBlock() {
      return opts.unit ?? result({ testCaseId: 0, passed: true })
    },
  }
}

describe("verifyReferenceSolution (io)", () => {
  it("one output per input: ok = the program ran cleanly, stdout = its output", async () => {
    const runner = fakeRunner({
      testCases: [
        result({ testCaseId: 1, actualOutput: "42" }),
        result({ testCaseId: 2, actualOutput: "", error: "ZeroDivisionError", errored: true }),
      ],
    })
    const outputs = await verifyReferenceSolution(
      { code: "x", problemType: "io", inputs: ["1", "2"] },
      "c",
      runner
    )
    expect(outputs).toEqual([
      { stdout: "42", stderr: "", ok: true },
      { stdout: "", stderr: "ZeroDivisionError", ok: false },
    ])
    expect(runner.calls[0].language).toBe("c")
    expect(runner.calls[0].cases).toHaveLength(2)
  })

  it("a stderr warning from a clean run is still ok (grading allows stderr)", async () => {
    const runner = fakeRunner({
      testCases: [result({ testCaseId: 1, actualOutput: "7", error: "warning: x" })],
    })
    const [out] = await verifyReferenceSolution({ code: "x", problemType: "io", inputs: [""] }, "python", runner)
    expect(out).toEqual({ stdout: "7", stderr: "warning: x", ok: true })
  })

  it("a compile failure (one synthetic result) marks every case as an error", async () => {
    const runner = fakeRunner({
      testCases: [result({ testCaseId: 0, error: "error: expected ';'", errored: true })],
    })
    const outputs = await verifyReferenceSolution(
      { code: "bad", problemType: "io", inputs: ["1", "2", "3"] },
      "c",
      runner
    )
    expect(outputs).toHaveLength(3)
    for (const o of outputs) expect(o).toEqual({ stdout: "", stderr: "error: expected ';'", ok: false })
  })

  it("no inputs → no outputs", async () => {
    expect(await verifyReferenceSolution({ code: "x", problemType: "io", inputs: [] }, "python", fakeRunner({}))).toEqual([])
  })
})

describe("verifyReferenceSolution (unit)", () => {
  it("runs the block once; ok = passed, stderr = the traceback", async () => {
    const runner = fakeRunner({ unit: result({ testCaseId: 0, passed: false, error: "AssertionError" }) })
    const outputs = await verifyReferenceSolution(
      { code: "def f(): pass", problemType: "unit", unitTestCode: "assert f()" },
      "python",
      runner
    )
    expect(outputs).toEqual([{ stdout: "", stderr: "AssertionError", ok: false }])
  })

  it("refuses a language without the unit harness — it would run the code as Python", async () => {
    const runner = fakeRunner({})
    await expect(
      verifyReferenceSolution({ code: "int main(){}", problemType: "unit", unitTestCode: "assert 1" }, "c", runner)
    ).rejects.toThrow(/not available/)
  })
})

// The pin: through the REAL adapter (Piston's HTTP stubbed), the same program +
// input + expected output gets the same verdict from grading and verification.
describe("verification and grading agree (real pistonRunner, stubbed Piston)", () => {
  afterEach(() => vi.unstubAllGlobals())

  function piston(response: object) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(response) }))
  }

  function problem(language: string, expectedOutput: string): GradableProblem {
    return {
      problemType: "io",
      language,
      score: 10,
      unitTestCode: "",
      blacklist: [],
      whitelist: [],
      testCases: [{ id: 1, input: "3", expectedOutput, isHidden: false, score: 10 }],
    }
  }

  async function both(language: string, expectedOutput: string) {
    const graded = await gradeSubmission(problem(language, expectedOutput), "code", "submit", pistonRunner)
    const [verified] = await verifyReferenceSolution(
      { code: "code", problemType: "io", inputs: ["3"] },
      language,
      pistonRunner
    )
    // The editor shows ✅ when ok and the trimmed stdout equals the expected output.
    const editorPass = verified.ok && verified.stdout.trim() === expectedOutput.trim()
    return { gradePass: graded.passedTests === 1, editorPass, verified }
  }

  it("stderr warning + correct output → both pass (was 🔴 in the editor)", async () => {
    piston({ run: { stdout: "9\n", stderr: "DeprecationWarning: x", code: 0, signal: null } })
    const r = await both("python", "9")
    expect(r).toMatchObject({ gradePass: true, editorPass: true })
  })

  it("non-zero exit after printing the right output → both fail", async () => {
    piston({ run: { stdout: "9\n", stderr: "", code: 1, signal: null } })
    const r = await both("python", "9")
    expect(r).toMatchObject({ gradePass: false, editorPass: false })
    expect(r.verified.ok).toBe(false)
  })

  it("C compile error → both fail, the gcc diagnostics surface", async () => {
    piston({
      compile: { stdout: "", stderr: "main.c:1: error: expected ';'", code: 1, signal: null },
      run: { stdout: "", stderr: "", code: 0, signal: null },
    })
    const r = await both("c", "9")
    expect(r).toMatchObject({ gradePass: false, editorPass: false })
    expect(r.verified.stderr).toContain("expected ';'")
  })

  it("wrong output from a clean run → both fail, but it's a mismatch (⚠️), not an error", async () => {
    piston({ run: { stdout: "8\n", stderr: "", code: 0, signal: null } })
    const r = await both("python", "9")
    expect(r).toMatchObject({ gradePass: false, editorPass: false })
    expect(r.verified.ok).toBe(true)
  })
})
