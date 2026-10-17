import { describe, it, expect } from "vitest"
import { buildSyllabusDraft, EMPTY_SYLLABUS, isSyllabusDirty, isSyllabusEmpty } from "./draft"

describe("buildSyllabusDraft — field errors", () => {
  it("names a wrong-typed text field in Thai, never by its key", () => {
    const result = buildSyllabusDraft({ credits: 3, description: ["x"], objectives: {}, resources: 1 })
    expect(result).toEqual({
      ok: false,
      errors: {
        credits: "หน่วยกิตต้องเป็นข้อความ",
        description: "คำอธิบายรายวิชาต้องเป็นข้อความ",
        objectives: "วัตถุประสงค์การเรียนรู้ต้องเป็นข้อความ",
        resources: "แหล่งเรียนรู้ต้องเป็นข้อความ",
      },
    })
  })
})

describe("isSyllabusEmpty", () => {
  it.each([
    ["nothing written", {}, true],
    ["credits only", { credits: "3" }, false],
    ["objectives only", { objectives: "x" }, false],
    ["Learning Resources only", { resources: "- ตำรา" }, false],
    ["a Teaching Plan only", { plan: [{ weekNo: 1, topic: "a", detail: "" }] }, false],
    ["Assessment Components only", { assessments: [{ name: "สอบ", weight: 50, note: "" }] }, false],
  ])("%s → %s", (_, patch, empty) => {
    expect(isSyllabusEmpty({ ...EMPTY_SYLLABUS, ...patch })).toBe(empty)
  })
})

describe("isSyllabusDirty — unsaved edits (#104)", () => {
  const saved = { ...EMPTY_SYLLABUS, credits: "3", plan: [{ weekNo: 1, topic: "แนะนำวิชา", detail: "" }] }
  it.each([
    ["not editing", null, false],
    ["editing, nothing changed", { ...saved }, false],
    ["a text field changed", { ...saved, resources: "ตำรา" }, true],
    ["a row changed", { ...saved, plan: [{ weekNo: 2, topic: "แนะนำวิชา", detail: "" }] }, true],
    ["a row added", { ...saved, assessments: [{ name: "สอบ", weight: 100, note: "" }] }, true],
  ])("%s → %s", (_, draft, dirty) => {
    expect(isSyllabusDirty(draft, saved)).toBe(dirty)
  })
})
