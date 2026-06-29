import { TestCase, TestResult } from "@/types"
import { getLanguageConfig } from "@/lib/languages"

const PISTON_API = process.env.PISTON_URL ?? "https://emkc.org/api/v2/piston"

interface PistonPhase {
  stdout: string
  stderr: string
  code: number
  signal: string | null
}

interface PistonResponse {
  // Present only for compiled languages (e.g. C). Interpreted languages
  // (Python) omit it.
  compile?: PistonPhase
  run: PistonPhase
}

async function runCode(
  code: string,
  input: string,
  language = "python"
): Promise<PistonResponse> {
  const cfg = getLanguageConfig(language)
  const res = await fetch(`${PISTON_API}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      language: cfg.piston,
      version: cfg.version,
      files: [{ name: cfg.filename, content: code }],
      stdin: input,
    }),
  })

  if (!res.ok) {
    throw new Error(`Piston API error: ${res.status}`)
  }

  return res.json()
}

export async function runReferenceSolution(
  code: string,
  inputs: string[]
): Promise<Array<{ stdout: string; stderr: string; ok: boolean }>> {
  return Promise.all(
    inputs.map(async (input) => {
      try {
        const response = await runCode(code, input)
        const stdout = response.run.stdout.trim()
        const stderr = response.run.stderr
        const ok = response.run.code === 0 && stderr === ""
        return { stdout, stderr, ok }
      } catch (error) {
        const stderr = error instanceof Error ? error.message : "Unknown error"
        return { stdout: "", stderr, ok: false }
      }
    })
  )
}

export async function runUnitTestBlock(
  studentCode: string,
  unitTestCode: string
): Promise<TestResult> {
  const harness = `${studentCode}

${unitTestCode}`
  try {
    const response = await runCode(harness, "")
    const stdout = response.run.stdout.trim()
    const stderr = response.run.stderr
    const passed = response.run.code === 0
    return {
      testCaseId: 0,
      passed,
      actualOutput: stdout,
      expectedOutput: "",
      executionTime: 0,
      error: passed ? undefined : stderr,
    } satisfies TestResult
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return {
      testCaseId: 0,
      passed: false,
      actualOutput: "",
      expectedOutput: "",
      executionTime: 0,
      error: message,
    } satisfies TestResult
  }
}

// Run one test case through Piston, mapping compile/run phases to a TestResult.
// `compileFailed` is reported separately so the caller can short-circuit.
async function runOneCase(
  code: string,
  tc: TestCase,
  language: string
): Promise<{ result: TestResult; compileFailed: boolean }> {
  try {
    const response = await runCode(code, tc.input, language)
    // Compiled languages (C) report a separate compile phase; a non-zero
    // compile code means the source never ran — surface the gcc diagnostics
    // and fail the case without comparing (empty) output.
    const compileFailed = !!response.compile && response.compile.code !== 0
    const actualOutput = response.run.stdout.trim()
    const expectedOutput = tc.expectedOutput.trim()
    const passed = !compileFailed && actualOutput === expectedOutput

    return {
      compileFailed,
      result: {
        testCaseId: tc.id,
        passed,
        actualOutput,
        expectedOutput,
        executionTime: 0,
        error: compileFailed
          ? response.compile!.stderr
          : response.run.stderr || undefined,
      } satisfies TestResult,
    }
  } catch (error) {
    return {
      compileFailed: false,
      result: {
        testCaseId: tc.id,
        passed: false,
        actualOutput: "",
        expectedOutput: tc.expectedOutput,
        executionTime: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      } satisfies TestResult,
    }
  }
}

export async function runTestCases(
  code: string,
  testCases: TestCase[],
  language = "python"
): Promise<TestResult[]> {
  if (testCases.length === 0) return []

  // Run the first case alone. For a compiled language, if it fails to compile
  // every case would fail with the same gcc error — so short-circuit to a
  // single compile-error result instead of recompiling N times.
  const first = await runOneCase(code, testCases[0], language)
  if (first.compileFailed) {
    return [{ ...first.result, testCaseId: 0 }]
  }

  const rest = await Promise.all(
    testCases.slice(1).map((tc) => runOneCase(code, tc, language))
  )
  return [first.result, ...rest.map((r) => r.result)]
}
