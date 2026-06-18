import { TestCase, TestResult } from "@/types"

const PISTON_API = "https://emkc.org/api/v2/piston"

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
