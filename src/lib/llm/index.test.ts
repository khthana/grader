import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { generateTestPlan, LlmNotConfiguredError } from "./index"

const CLEAN_RESPONSE = {
  content: [
    {
      text: JSON.stringify({
        solution: "print(int(input())**2)",
        inputs: ["3", "5", "0"],
      }),
    },
  ],
}

const FENCED_RESPONSE = {
  content: [
    {
      text:
        "Here is the solution:\n```json\n" +
        JSON.stringify({ solution: "print(int(input())**2)", inputs: ["3", "5", "0"] }) +
        "\n```\n",
    },
  ],
}

function mockFetch(data: unknown, ok = true, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok, status, json: async () => data })
  )
}

beforeEach(() => {
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key")
  vi.stubEnv("LLM_API_KEY", "")
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("generateTestPlan", () => {
  it("returns solution and inputs from clean JSON response", async () => {
    mockFetch(CLEAN_RESPONSE)
    const result = await generateTestPlan({ title: "Square", description: "Print n squared" })
    expect(result.solution).toBe("print(int(input())**2)")
    expect(result.inputs).toEqual(["3", "5", "0"])
  })

  it("parses solution and inputs when LLM wraps JSON in markdown fences", async () => {
    mockFetch(FENCED_RESPONSE)
    const result = await generateTestPlan({ title: "Square", description: "Print n squared" })
    expect(result.solution).toBe("print(int(input())**2)")
    expect(result.inputs).toEqual(["3", "5", "0"])
  })

  it("throws LlmNotConfiguredError when no API key is set", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "")
    vi.stubEnv("LLM_API_KEY", "")
    await expect(
      generateTestPlan({ title: "Square", description: "Print n squared" })
    ).rejects.toThrow(LlmNotConfiguredError)
  })

  it("throws when Anthropic API returns a non-ok response", async () => {
    mockFetch({ error: { message: "rate limit exceeded" } }, false, 429)
    await expect(
      generateTestPlan({ title: "Square", description: "Print n squared" })
    ).rejects.toThrow("429")
  })

  it("coerces numeric inputs to strings", async () => {
    mockFetch({
      content: [
        { text: JSON.stringify({ solution: "print(int(input()))", inputs: [1, 2, 3] }) },
      ],
    })
    const result = await generateTestPlan({ title: "Echo", description: "Print n" })
    expect(result.inputs).toEqual(["1", "2", "3"])
  })

  it("problemType='unit' → result has solution and unitTestCode", async () => {
    mockFetch({
      content: [
        {
          text: JSON.stringify({
            solution: "def add(a, b): return a + b",
            unit_test_code: "assert add(1, 2) == 3\nassert add(0, 0) == 0",
          }),
        },
      ],
    })
    const result = await generateTestPlan({
      title: "Add", description: "Write add(a,b)", problemType: "unit",
    })
    expect("unitTestCode" in result).toBe(true)
    if ("unitTestCode" in result) {
      expect(result.solution).toBe("def add(a, b): return a + b")
      expect(result.unitTestCode).toContain("assert add(1, 2) == 3")
    }
  })

  it("problemType='unit' → prompt sent to API contains unit-test signal", async () => {
    mockFetch({
      content: [{
        text: JSON.stringify({ solution: "def add(a,b): return a+b", unit_test_code: "assert add(1,2)==3" }),
      }],
    })
    await generateTestPlan({ title: "Add", description: "Write add(a,b)", problemType: "unit" })
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string) as { messages: Array<{ content: string }> }
    const prompt = body.messages[0].content
    expect(prompt).toContain("unit-test")
    expect(prompt).toContain("unit_test_code")
  })

  it("problemType='io' → returns inputs[], not unitTestCode", async () => {
    mockFetch(CLEAN_RESPONSE)
    const result = await generateTestPlan({ title: "Square", description: "Print n squared", problemType: "io" })
    expect("inputs" in result).toBe(true)
    expect("unitTestCode" in result).toBe(false)
  })

  it("problemType omitted → returns inputs[] (backward compat)", async () => {
    mockFetch(CLEAN_RESPONSE)
    const result = await generateTestPlan({ title: "Square", description: "Print n squared" })
    expect("inputs" in result).toBe(true)
    expect("unitTestCode" in result).toBe(false)
  })

  it("passes inputSpec and outputSpec to the API when provided", async () => {
    mockFetch(CLEAN_RESPONSE)
    await generateTestPlan({
      title: "Square",
      description: "Print n squared",
      inputSpec: "one integer n",
      outputSpec: "n squared",
    })
    const fetchCall = vi.mocked(fetch).mock.calls[0]
    const body = JSON.parse(fetchCall[1]?.body as string) as {
      messages: Array<{ content: string }>
    }
    const prompt = body.messages[0].content
    expect(prompt).toContain("one integer n")
    expect(prompt).toContain("n squared")
  })
})
