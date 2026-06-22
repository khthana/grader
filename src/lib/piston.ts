import { TestCase, TestResult } from "@/types"

const PISTON_API = process.env.PISTON_URL ?? "https://emkc.org/api/v2/piston"

interface PistonResponse {
  run: {
    stdout: string
    stderr: string
    code: number
    signal: string | null
  }
}

async function runCode(code: string, input: string): Promise<PistonResponse> {
  const res = await fetch(`${PISTON_API}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      language: "python",
      version: "3.10.0",
      files: [{ content: code }],
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

export async function runUnitTestCases(
  functionName: string,
  testCases: TestCase[],
  studentCode: string
): Promise<TestResult[]> {
  return Promise.all(
    testCases.map(async (tc) => {
      const harness = `${studentCode}

try:
    _result = ${functionName}(${tc.input})
    _expected = ${tc.expectedOutput}
    if _result == _expected:
        print("PASS")
    else:
        print(f"FAIL:{repr(_result)}")
except Exception as e:
    print(f"ERROR:{str(e)}")
`
      try {
        const response = await runCode(harness, "")
        const stdout = response.run.stdout.trim()
        if (stdout === "PASS") {
          return {
            testCaseId: tc.id,
            passed: true,
            actualOutput: tc.expectedOutput,
            expectedOutput: tc.expectedOutput,
            executionTime: 0,
          } satisfies TestResult
        }
        if (stdout.startsWith("FAIL:")) {
          const actualOutput = stdout.slice(5)
          return {
            testCaseId: tc.id,
            passed: false,
            actualOutput,
            expectedOutput: tc.expectedOutput,
            executionTime: 0,
          } satisfies TestResult
        }
        // ERROR: or unexpected output
        const errorMsg = stdout.startsWith("ERROR:") ? stdout.slice(6) : stdout
        return {
          testCaseId: tc.id,
          passed: false,
          actualOutput: "",
          expectedOutput: tc.expectedOutput,
          executionTime: 0,
          error: errorMsg,
        } satisfies TestResult
      } catch (error) {
        return {
          testCaseId: tc.id,
          passed: false,
          actualOutput: "",
          expectedOutput: tc.expectedOutput,
          executionTime: 0,
          error: error instanceof Error ? error.message : "Unknown error",
        } satisfies TestResult
      }
    })
  )
}

export async function runTestCases(
  code: string,
  testCases: TestCase[]
): Promise<TestResult[]> {
  const results = await Promise.all(
    testCases.map(async (tc) => {
      try {
        const response = await runCode(code, tc.input)
        const actualOutput = response.run.stdout.trim()
        const expectedOutput = tc.expectedOutput.trim()
        const passed = actualOutput === expectedOutput

        return {
          testCaseId: tc.id,
          passed,
          actualOutput,
          expectedOutput,
          executionTime: 0,
          error: response.run.stderr || undefined,
        } satisfies TestResult
      } catch (error) {
        return {
          testCaseId: tc.id,
          passed: false,
          actualOutput: "",
          expectedOutput: tc.expectedOutput,
          executionTime: 0,
          error: error instanceof Error ? error.message : "Unknown error",
        } satisfies TestResult
      }
    })
  )

  return results
}
