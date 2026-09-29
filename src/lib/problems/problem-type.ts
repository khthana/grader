import { supportsAiGeneration, supportsUnitTests } from "@/lib/languages"

// How a Problem is graded: `io` compares stdout per Test Case; `unit` runs one
// pytest-style test block against the student's code (#55).
export type ProblemType = "io" | "unit"

// Whether an untrusted value names a Problem Type exactly — for callers that
// must reject a malformed value instead of defaulting it to io.
export function isProblemType(value: unknown): value is ProblemType {
  return value === "io" || value === "unit"
}

// Normalise an untrusted/stored value: anything but "unit" is the default io
// mode — the same reading every grading path already applies.
export function toProblemType(value: unknown): ProblemType {
  return value === "unit" ? "unit" : "io"
}

// What a Problem Type may do in a course of a given language (#86) — the
// server-side answer; ProblemEditor mirrors it to hide controls. io works in
// every language; the unit harness is Python-only (#64).
export function isProblemTypeAllowed(type: ProblemType, language: string): boolean {
  return type === "io" || supportsUnitTests(language)
}

// Whether AI may write a solution + tests of this type for the course language.
// The prompts are Python-only, so a C course never reaches the LLM.
export function canGenerateTests(type: ProblemType, language: string): boolean {
  return supportsAiGeneration(language) && isProblemTypeAllowed(type, language)
}
