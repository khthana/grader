import { describe, it, expect } from "vitest"
import { buildSyllabusDraft, EMPTY_SYLLABUS, isSyllabusEmpty } from "./draft"

describe("buildSyllabusDraft — field errors", () => {
  it("names a wrong-typed text field in Thai, never by its key", () => {
    const result = buildSyllabusDraft({ credits: 3, description: ["x"], objectives: {} })
    expect(result).toEqual({
      ok: false,
      errors: {
        credits: "หน่วยกิตต้องเป็นข้อความ",
        description: "คำอธิบายรายวิชาต้องเป็นข้อความ",
        objectives: "วัตถุประสงค์การเรียนรู้ต้องเป็นข้อความ",
      },
    })
  })
})

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
