import { describe, it, expect } from "vitest"
import { getLanguageConfig, isSupportedLanguage, SUPPORTED_LANGUAGES } from "./languages"

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

describe("supported languages", () => {
  it("lists the languages a course may choose (python + c)", () => {
    expect(SUPPORTED_LANGUAGES).toContain("python")
    expect(SUPPORTED_LANGUAGES).toContain("c")
  })

  it("recognises supported languages and rejects unknown ones", () => {
    expect(isSupportedLanguage("python")).toBe(true)
    expect(isSupportedLanguage("c")).toBe(true)
    expect(isSupportedLanguage("rust")).toBe(false)
    expect(isSupportedLanguage("")).toBe(false)
  })
})
