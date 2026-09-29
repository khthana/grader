// Single source of truth for the language-specific facts the grader needs.
// Adding a future language (C++, Java, …) is one new entry here.
//
// `piston`/`version` are the Piston runtime + version used in an execute call;
// `filename` is the source file name sent to Piston. The gcc package appends
// `.c` to whatever name it receives (so `main.c` compiles as `main.c.c`, which
// gcc accepts) — verified against the self-hosted engine (issue #61).
export interface LanguageConfig {
  piston: string
  version: string
  filename: string
  // Human-readable label for editor toolbars / pickers (UI single-sources it).
  label: string
  // Line-comment prefix, for editor placeholders written as a code comment.
  commentPrefix: string
  // A typical first line of starter code, shown as an example in the editor.
  starterHint: string
  // Whether unit-test mode is available — its harness only runs Python (#64).
  unitTests: boolean
  // Whether "สร้างด้วย AI" is offered — the prompts ask for Python code.
  aiGeneration: boolean
}

// A language code a course may declare (a key of the registry below).
export type Language = "python" | "c"

export const LANGUAGE_CONFIG: Record<Language, LanguageConfig> = {
  python: {
    piston: "python",
    version: "3.10.0",
    filename: "main.py",
    label: "Python",
    commentPrefix: "#",
    starterHint: "def add(a, b):",
    unitTests: true,
    aiGeneration: true,
  },
  c: {
    piston: "c",
    version: "10.2.0",
    filename: "main.c",
    label: "C",
    commentPrefix: "//",
    starterHint: "#include <stdio.h>",
    unitTests: false,
    aiGeneration: false,
  },
}

export const DEFAULT_LANGUAGE: Language = "python"

// The languages a course may be set to — the registry keys, single-sourced.
export const SUPPORTED_LANGUAGES = Object.keys(LANGUAGE_CONFIG) as Language[]

// `<select>` options for picking a course language — derived from the
// registry, so adding a language never needs a second list (#68).
export const LANGUAGE_OPTIONS: { value: string; label: string }[] = SUPPORTED_LANGUAGES.map(
  (value) => ({ value, label: LANGUAGE_CONFIG[value].label })
)

// Whether a language code is one a course/problem may declare. Unlike
// getLanguageConfig (which silently falls back to Python at execution time),
// this is the strict check used to validate user-supplied input.
export function isSupportedLanguage(language: string): language is Language {
  return Object.prototype.hasOwnProperty.call(LANGUAGE_CONFIG, language)
}

// Resolve a language code to its config, falling back to Python for anything
// unknown so a stray/blank value can never break execution.
export function getLanguageConfig(language: string): LanguageConfig {
  return isSupportedLanguage(language) ? LANGUAGE_CONFIG[language] : LANGUAGE_CONFIG[DEFAULT_LANGUAGE]
}

// `text` as a line comment in the given language (e.g. an editor placeholder).
export function commentLine(language: string, text: string): string {
  return `${getLanguageConfig(language).commentPrefix} ${text}`
}

// Whether unit-test mode may be used in a course of this language. Strict: an
// unknown language gets io-only, never the Python harness.
export function supportsUnitTests(language: string): boolean {
  return isSupportedLanguage(language) && LANGUAGE_CONFIG[language].unitTests
}

// Whether AI test-case generation may be offered for this language.
export function supportsAiGeneration(language: string): boolean {
  return isSupportedLanguage(language) && LANGUAGE_CONFIG[language].aiGeneration
}
