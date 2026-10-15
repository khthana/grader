import { describe, it, expect } from "vitest"
import { parseQuizImport, dontKnowLetter } from "./import"
import w01 from "./fixtures/w01-pretest.json"

describe("parseQuizImport", () => {
  it("imports the real Week 1 Pre-test file as 15 questions in `no` order", () => {
    const result = parseQuizImport(w01)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.draft.title).toBe("Pre-test: พื้นฐานภาษา C ก่อนเรียน OOP ด้วย C++")
    expect(result.draft.questions).toHaveLength(15)
    const q1 = result.draft.questions[0]
    expect(q1.topic).toBe("Pointer พื้นฐาน")
    expect(q1.prompt).toBe("โปรแกรมต่อไปนี้พิมพ์ค่าอะไร")
    expect(q1.code).toContain("int *p = &x;")
    expect(q1.choices).toEqual([
      { letter: "A", text: "5" },
      { letter: "B", text: "address ของ x" },
      { letter: "C", text: "compile ไม่ผ่าน" },
      { letter: "D", text: "10" },
    ])
    expect(q1.correctLetter).toBe("D")
    expect(q1.feedback).toMatch(/^คำตอบที่ถูกคือ D/)
    // Question 3 has no code snippet.
    expect(result.draft.questions[2].code).toBeNull()
    expect(result.draft.questions[14].correctLetter).toBe("C")
  })

  it("ignores the ungraded `background` section with a notice", () => {
    const result = parseQuizImport(w01)
    expect(result.ok && result.notices).toEqual([
      "ข้ามส่วน background (แบบสำรวจไม่คิดคะแนน) 4 ข้อ",
    ])
  })

  it("has no notices when there is no background section", () => {
    const result = parseQuizImport({ title: "T", questions: [question()] })
    expect(result.ok && result.notices).toEqual([])
  })

  it("orders questions by `no`, not by array position", () => {
    const result = parseQuizImport({
      title: "T",
      questions: [question({ no: 2, prompt: "second" }), question({ no: 1, prompt: "first" })],
    })
    expect(result.ok && result.draft.questions.map((q) => q.prompt)).toEqual(["first", "second"])
  })

  it("trims text and treats a blank code snippet or topic as absent", () => {
    const result = parseQuizImport({
      title: "  T  ",
      description: " d ",
      questions: [question({ prompt: "  p  ", code: "   ", topic: undefined })],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.draft.title).toBe("T")
    expect(result.draft.description).toBe("d")
    expect(result.draft.questions[0]).toMatchObject({ prompt: "p", code: null, topic: "" })
  })

  it.each([
    ["not an object", "x", "ไฟล์ต้องเป็น JSON object"],
    ["no title", { questions: [question()] }, "ต้องมี title"],
    ["no questions", { title: "T", questions: [] }, "ต้องมี questions อย่างน้อย 1 ข้อ"],
    ["questions not an array", { title: "T", questions: "x" }, "ต้องมี questions อย่างน้อย 1 ข้อ"],
  ])("rejects %s", (_label, input, error) => {
    const result = parseQuizImport(input)
    expect(result).toEqual({ ok: false, errors: [error] })
  })

  it.each([
    ["no prompt", { prompt: "" }, "ข้อ 1: ต้องมีโจทย์ (prompt)"],
    [
      "no correct choice",
      { choices: [choice("A", false), choice("B", false)] },
      "ข้อ 1: ต้องมีตัวเลือกที่ถูกเพียง 1 ตัว (พบ 0)",
    ],
    [
      "two correct choices",
      { choices: [choice("A", true), choice("B", true)] },
      "ข้อ 1: ต้องมีตัวเลือกที่ถูกเพียง 1 ตัว (พบ 2)",
    ],
    [
      "duplicate letters",
      { choices: [choice("A", true), choice("A", false)] },
      "ข้อ 1: ตัวอักษรตัวเลือกซ้ำ (A)",
    ],
    ["fewer than two choices", { choices: [choice("A", true)] }, "ข้อ 1: ต้องมีตัวเลือกอย่างน้อย 2 ตัว"],
    [
      "a choice without text",
      { choices: [choice("A", true), { letter: "B", text: " ", correct: false }] },
      "ข้อ 1: ตัวเลือก B ไม่มีข้อความ",
    ],
  ])("reports a per-question error for %s", (_label, override, error) => {
    const result = parseQuizImport({ title: "T", questions: [question(override)] })
    expect(result).toEqual({ ok: false, errors: [error] })
  })

  it("labels errors with the question's `no` and collects every one", () => {
    const result = parseQuizImport({
      title: "T",
      questions: [question({ no: 1 }), question({ no: 7, prompt: "" }), question({ no: 9, choices: [] })],
    })
    expect(result).toEqual({
      ok: false,
      errors: ["ข้อ 7: ต้องมีโจทย์ (prompt)", "ข้อ 9: ต้องมีตัวเลือกอย่างน้อย 2 ตัว"],
    })
  })
})

describe("dontKnowLetter", () => {
  it.each([
    [["A", "B", "C", "D"], "E"],
    [["A", "B", "C", "D", "E"], "F"],
    [["A", "B"], "C"],
  ])("follows the last choice %j with %s", (letters, expected) => {
    expect(dontKnowLetter(letters.map((letter) => ({ letter, text: "x" })))).toBe(expected)
  })
})

function choice(letter: string, correct: boolean) {
  return { letter, text: `ตัวเลือก ${letter}`, correct }
}

function question(override: Record<string, unknown> = {}) {
  return {
    no: 1,
    topic: "หัวข้อ",
    prompt: "โจทย์",
    code: null,
    choices: [choice("A", true), choice("B", false)],
    feedback: "เพราะ A",
    ...override,
  }
}
