import { describe, it, expect } from "vitest"
import { EMPTY_SYLLABUS, isSyllabusEmpty } from "./draft"

describe("isSyllabusEmpty", () => {
  it.each([
    ["nothing written", {}, true],
    ["credits only", { credits: "3" }, false],
    ["objectives only", { objectives: "x" }, false],
    ["a Teaching Plan only", { plan: [{ weekNo: 1, topic: "a", detail: "" }] }, false],
    ["Assessment Components only", { assessments: [{ name: "สอบ", weight: 50, note: "" }] }, false],
  ])("%s → %s", (_, patch, empty) => {
    expect(isSyllabusEmpty({ ...EMPTY_SYLLABUS, ...patch })).toBe(empty)
  })
})
