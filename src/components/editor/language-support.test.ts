import { describe, it, expect } from "vitest"
import { SUPPORTED_LANGUAGES } from "@/lib/languages"
import { hasEditorGrammar } from "./language-support"

// #68 — adding a language to the registry must not silently fall back to
// Python highlighting: every supported language needs its own grammar.
describe("editor grammar", () => {
  it.each(SUPPORTED_LANGUAGES)("has a CodeMirror grammar for %s", (language) => {
    expect(hasEditorGrammar(language)).toBe(true)
  })
})
