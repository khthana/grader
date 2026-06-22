import { describe, it, expect, vi, beforeEach } from "vitest"
import { runReferenceSolution, runUnitTestBlock } from "./piston"

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
