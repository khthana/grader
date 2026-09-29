import { describe, it, expect } from "vitest"
import { getLanguageConfig, isSupportedLanguage, SUPPORTED_LANGUAGES, LANGUAGE_OPTIONS, commentLine, supportsUnitTests, supportsAiGeneration } from "./languages"

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

describe("display label", () => {
  it("exposes a human label for each language", () => {
    expect(getLanguageConfig("python").label).toBe("Python")
    expect(getLanguageConfig("c").label).toBe("C")
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

describe("picker options (#68)", () => {
  it("lists every supported language with its label, in registry order", () => {
    expect(LANGUAGE_OPTIONS).toEqual(
      SUPPORTED_LANGUAGES.map((value) => ({ value, label: getLanguageConfig(value).label }))
    )
    expect(LANGUAGE_OPTIONS).toContainEqual({ value: "c", label: "C" })
  })
})

describe("commentLine (#68)", () => {
  it("uses # for Python", () => {
    expect(commentLine("python", "hint")).toBe("# hint")
  })

  it("uses // for C", () => {
    expect(commentLine("c", "hint")).toBe("// hint")
  })

  it("falls back to Python's prefix for an unknown language", () => {
    expect(commentLine("rust", "hint")).toBe("# hint")
  })
})

describe("supportsUnitTests", () => {
  it("is Python-only (the unit harness runs Python)", () => {
    expect(supportsUnitTests("python")).toBe(true)
    expect(supportsUnitTests("c")).toBe(false)
    expect(supportsUnitTests("rust")).toBe(false)
  })
})

describe("supportsAiGeneration", () => {
  it("is Python-only (the prompts ask for Python code)", () => {
    expect(supportsAiGeneration("python")).toBe(true)
    expect(supportsAiGeneration("c")).toBe(false)
    expect(supportsAiGeneration("rust")).toBe(false)
  })
})
