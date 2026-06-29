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
}

export const LANGUAGE_CONFIG: Record<string, LanguageConfig> = {
  python: { piston: "python", version: "3.10.0", filename: "main.py", label: "Python" },
  c: { piston: "c", version: "10.2.0", filename: "main.c", label: "C" },
}

export const DEFAULT_LANGUAGE = "python"

// The languages a course may be set to — the registry keys, single-sourced.
export const SUPPORTED_LANGUAGES = Object.keys(LANGUAGE_CONFIG)

// Whether a language code is one a course/problem may declare. Unlike
// getLanguageConfig (which silently falls back to Python at execution time),
// this is the strict check used to validate user-supplied input.
export function isSupportedLanguage(language: string): boolean {
  return Object.prototype.hasOwnProperty.call(LANGUAGE_CONFIG, language)
}

// Resolve a language code to its config, falling back to Python for anything
// unknown so a stray/blank value can never break execution.
export function getLanguageConfig(language: string): LanguageConfig {
  return LANGUAGE_CONFIG[language] ?? LANGUAGE_CONFIG[DEFAULT_LANGUAGE]
}
