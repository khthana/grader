import { describe, it, expect } from "vitest"
import { getLanguageConfig } from "./languages"

describe("getLanguageConfig", () => {
  it("returns the C runtime config (Piston c / gcc 10.2.0 / main.c)", () => {
    const c = getLanguageConfig("c")
    expect(c.piston).toBe("c")
    expect(c.version).toBe("10.2.0")
    expect(c.filename).toBe("main.c")
  })

  it("falls back to Python config for an unknown or blank language", () => {
    expect(getLanguageConfig("rust")).toEqual(getLanguageConfig("python"))
    expect(getLanguageConfig("")).toEqual(getLanguageConfig("python"))
    expect(getLanguageConfig("python").piston).toBe("python")
  })
})
