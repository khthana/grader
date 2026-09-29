// How a Problem is graded: `io` compares stdout per Test Case; `unit` runs one
// pytest-style test block against the student's code (#55).
export type ProblemType = "io" | "unit"

// Normalise an untrusted/stored value: anything but "unit" is the default io
// mode — the same reading every grading path already applies.
export function toProblemType(value: unknown): ProblemType {
  return value === "unit" ? "unit" : "io"
}
