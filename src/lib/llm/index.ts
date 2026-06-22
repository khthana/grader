export class LlmNotConfiguredError extends Error {
  name = "LlmNotConfiguredError"
  constructor() {
    super("LLM not configured — set ANTHROPIC_API_KEY or LLM_API_KEY")
  }
}

function extractJson(text: string): string {
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start === -1 || end === -1) throw new Error("No JSON found in LLM response")
  return text.slice(start, end + 1)
}

export type IoTestPlan   = { solution: string; inputs: string[] }
export type UnitTestPlan = { solution: string; tests: { args: string; expectedReturn: string }[] }

export async function generateTestPlan(problem: {
  title: string
  description: string
  inputSpec?: string | null
  outputSpec?: string | null
  problemType?: "io" | "unit"
}): Promise<IoTestPlan | UnitTestPlan> {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.LLM_API_KEY || ""
  if (!apiKey) throw new LlmNotConfiguredError()

  const model = process.env.LLM_MODEL || "claude-haiku-4-5-20251001"
  const isUnit = problem.problemType === "unit"

  const parts = [
    `Title: ${problem.title}`,
    `Description: ${problem.description}`,
    problem.inputSpec ? `Input format: ${problem.inputSpec}` : null,
    problem.outputSpec ? `Output format: ${problem.outputSpec}` : null,
  ]
    .filter(Boolean)
    .join("\n")

  const prompt = isUnit
    ? `You are a programming test designer. Given the following Python unit-test problem, write:
1. A correct Python function implementation
2. A diverse set of 8-10 test cases covering normal values, edge cases, and boundary values

Return ONLY valid JSON with no markdown, no explanation:
{"solution":"<Python function code>","tests":[{"args":"<python literal args>","expected_return":"<python literal>"},...]}

Problem:
${parts}`
    : `You are a programming test designer. Given the following Python programming problem, write:
1. A correct Python solution
2. A diverse set of 8-10 test inputs covering normal values, edge cases, and boundary values

Return ONLY valid JSON with no markdown, no explanation:
{"solution":"<Python code>","inputs":["<input1>","<input2>",...]}

Problem:
${parts}`

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  })

  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as {
      error?: { message?: string }
    }
    throw new Error(
      `Anthropic API error ${response.status}: ${err.error?.message ?? "unknown"}`
    )
  }

  const data = (await response.json()) as { content: Array<{ text: string }> }
  const text = data.content[0].text

  if (isUnit) {
    const parsed = JSON.parse(extractJson(text)) as {
      solution: string
      tests: Array<{ args: unknown; expected_return: unknown }>
    }
    return {
      solution: parsed.solution,
      tests: parsed.tests.map((t) => ({
        args: String(t.args),
        expectedReturn: String(t.expected_return),
      })),
    }
  }

  const parsed = JSON.parse(extractJson(text)) as {
    solution: string
    inputs: unknown[]
  }
  return {
    solution: parsed.solution,
    inputs: parsed.inputs.map(String),
  }
}
