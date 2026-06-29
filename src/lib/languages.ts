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
}

export const LANGUAGE_CONFIG: Record<string, LanguageConfig> = {
  python: { piston: "python", version: "3.10.0", filename: "main.py" },
  c: { piston: "c", version: "10.2.0", filename: "main.c" },
}

const DEFAULT_LANGUAGE = "python"

// Resolve a language code to its config, falling back to Python for anything
// unknown so a stray/blank value can never break execution.
export function getLanguageConfig(language: string): LanguageConfig {
  return LANGUAGE_CONFIG[language] ?? LANGUAGE_CONFIG[DEFAULT_LANGUAGE]
}
