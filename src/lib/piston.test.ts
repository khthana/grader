import { describe, it, expect, vi, beforeEach } from "vitest"
import { runReferenceSolution } from "./piston"

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
