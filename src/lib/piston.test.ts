import { describe, it, expect, vi, beforeEach } from "vitest"
import { runReferenceSolution, runUnitTestBlock, runTestCases } from "./piston"

function mockPiston(response: { stdout: string; stderr: string; code: number }) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ run: response }),
    })
  )
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe("runReferenceSolution", () => {
  it("returns trimmed stdout with ok:true when piston exits cleanly", async () => {
    mockPiston({ stdout: "42\n", stderr: "", code: 0 })
    const results = await runReferenceSolution("print(42)", [""])
    expect(results).toHaveLength(1)
    expect(results[0].stdout).toBe("42")
    expect(results[0].stderr).toBe("")
    expect(results[0].ok).toBe(true)
  })

  it("ok:false when stderr is non-empty even if exit code is 0", async () => {
    mockPiston({ stdout: "", stderr: "NameError: x", code: 0 })
    const [r] = await runReferenceSolution("x", [""])
    expect(r.ok).toBe(false)
    expect(r.stderr).toBe("NameError: x")
  })

  it("ok:false when exit code is non-zero", async () => {
    mockPiston({ stdout: "", stderr: "", code: 1 })
    const [r] = await runReferenceSolution("raise SystemExit(1)", [""])
    expect(r.ok).toBe(false)
  })

  it("returns one result per input in order", async () => {
    let call = 0
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        const stdout = call === 0 ? "hello\n" : "world\n"
        call++
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ run: { stdout, stderr: "", code: 0 } }),
        })
      })
    )
    const results = await runReferenceSolution("print('x')", ["a", "b"])
    expect(results).toHaveLength(2)
    expect(results[0].stdout).toBe("hello")
    expect(results[1].stdout).toBe("world")
  })

  it("returns ok:false with error in stderr when piston fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")))
    const [r] = await runReferenceSolution("print(1)", [""])
    expect(r.ok).toBe(false)
    expect(r.stderr).toContain("network error")
  })

  it("runs a C reference solution through the gcc runtime", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          compile: { stdout: "", stderr: "", code: 0 },
          run: { stdout: "7\n", stderr: "", code: 0 },
        }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const [r] = await runReferenceSolution("int main(){...}", ["3 4"], "c")
    expect(r.ok).toBe(true)
    expect(r.stdout).toBe("7")

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.language).toBe("c")
    expect(body.version).toBe("10.2.0")
    expect(body.files[0].name).toBe("main.c")
  })

  it("reports ok:false with the gcc compile error when a C reference does not compile", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            compile: { stdout: "", stderr: "main.c.c:1:1: error: expected ';'", code: 1 },
            run: { stdout: "", stderr: "", code: 0 },
          }),
      })
    )

    const [r] = await runReferenceSolution("int main(){bad}", ["3 4"], "c")
    expect(r.ok).toBe(false)
    expect(r.stderr).toContain("error: expected ';'")
  })
})

describe("runUnitTestBlock", () => {
  it("passed:true when the combined code exits cleanly (all asserts pass)", async () => {
    mockPiston({ stdout: "", stderr: "", code: 0 })
    const result = await runUnitTestBlock("def add(a,b): return a+b", "assert add(1,2) == 3")
    expect(result.passed).toBe(true)
  })

  it("passed:false with traceback in error when an assert fails (non-zero exit)", async () => {
    mockPiston({
      stdout: "",
      stderr: "Traceback (most recent call last):\n  ...\nAssertionError",
      code: 1,
    })
    const result = await runUnitTestBlock("def add(a,b): return 0", "assert add(1,2) == 3")
    expect(result.passed).toBe(false)
    expect(result.error).toContain("AssertionError")
  })

  it("passed:false with error when piston fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")))
    const result = await runUnitTestBlock("x = 1", "assert x == 1")
    expect(result.passed).toBe(false)
    expect(result.error).toContain("network error")
  })
})

describe("runTestCases — language-aware execution", () => {
  it("runs C through the gcc runtime and compares stdout on a clean compile+run", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          compile: { stdout: "", stderr: "", code: 0 },
          run: { stdout: "7\n", stderr: "", code: 0 },
        }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const [r] = await runTestCases(
      "int main(){...}",
      [{ id: 1, input: "3 4", expectedOutput: "7", isHidden: false }],
      "c"
    )

    expect(r.passed).toBe(true)
    expect(r.actualOutput).toBe("7")

    // The request to Piston carries the C runtime + a named .c source file.
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.language).toBe("c")
    expect(body.version).toBe("10.2.0")
    expect(body.files[0].name).toBe("main.c")
  })

  it("fails the case and surfaces the gcc compile error when C does not compile", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            compile: { stdout: "", stderr: "main.c.c:1:1: error: expected ';'", code: 1 },
            run: { stdout: "", stderr: "", code: 0 },
          }),
      })
    )

    const [r] = await runTestCases(
      "int main(){bad}",
      [{ id: 1, input: "", expectedOutput: "7", isHidden: false }],
      "c"
    )

    expect(r.passed).toBe(false)
    expect(r.error).toContain("error: expected ';'")
  })

  it("fails the case and surfaces the runtime stderr when C compiles but crashes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            compile: { stdout: "", stderr: "", code: 0 },
            run: { stdout: "", stderr: "Segmentation fault (core dumped)", code: 139 },
          }),
      })
    )

    const [r] = await runTestCases(
      "int main(){int*p=0;*p=1;}",
      [{ id: 1, input: "", expectedOutput: "7", isHidden: false }],
      "c"
    )

    expect(r.passed).toBe(false)
    expect(r.error).toContain("Segmentation fault")
  })

  it("compiles once and returns a single compile-error result for C (no recompile per case)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          compile: { stdout: "", stderr: "boom: compile error", code: 1 },
          run: { stdout: "", stderr: "", code: 0 },
        }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const results = await runTestCases(
      "int main(){bad}",
      [
        { id: 1, input: "a", expectedOutput: "1", isHidden: false },
        { id: 2, input: "b", expectedOutput: "2", isHidden: false },
        { id: 3, input: "c", expectedOutput: "3", isHidden: false },
      ],
      "c"
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(results).toHaveLength(1)
    expect(results[0].passed).toBe(false)
    expect(results[0].error).toContain("boom: compile error")
  })
})
