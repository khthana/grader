// Quiz import (ADR 0011): the one parser that turns the instructor's
// Google-Form `DATA` JSON into a Quiz draft. Create and preview both go through
// it — routes never validate the raw body themselves (cf. Problem Draft, #83).
// Pure: no DB, no I/O.

export interface QuizChoice {
  letter: string
  text: string
}

export interface QuizQuestionDraft {
  topic: string
  prompt: string
  code: string | null
  choices: QuizChoice[]
  correctLetter: string
  feedback: string
}

export interface QuizDraft {
  title: string
  description: string
  questions: QuizQuestionDraft[]
}

export type QuizImportResult =
  | { ok: true; draft: QuizDraft; notices: string[] }
  | { ok: false; errors: string[] }

type Obj = Record<string, unknown>

const isObject = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v)
const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "")

export function parseQuizImport(input: unknown): QuizImportResult {
  if (!isObject(input)) return { ok: false, errors: ["ไฟล์ต้องเป็น JSON object"] }

  const title = text(input.title)
  if (!title) return { ok: false, errors: ["ต้องมี title"] }

  const raw = input.questions
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, errors: ["ต้องมี questions อย่างน้อย 1 ข้อ"] }
  }

  // Order by `no` (stable for ties / missing numbers).
  const numbered = raw.map((q, i) => {
    const no = isObject(q) && typeof q.no === "number" ? q.no : i + 1
    return { q, no, i }
  })
  numbered.sort((a, b) => a.no - b.no || a.i - b.i)

  const errors: string[] = []
  const questions: QuizQuestionDraft[] = []
  for (const { q, no } of numbered) {
    const parsed = parseQuestion(q)
    if (typeof parsed === "string") errors.push(`ข้อ ${no}: ${parsed}`)
    else questions.push(parsed)
  }
  if (errors.length > 0) return { ok: false, errors }

  const notices: string[] = []
  if (Array.isArray(input.background) && input.background.length > 0) {
    notices.push(`ข้ามส่วน background (แบบสำรวจไม่คิดคะแนน) ${input.background.length} ข้อ`)
  }

  return { ok: true, draft: { title, description: text(input.description), questions }, notices }
}

/** A parsed question, or the first problem with it. */
function parseQuestion(q: unknown): QuizQuestionDraft | string {
  if (!isObject(q)) return "ต้องเป็น object"
  const prompt = text(q.prompt)
  if (!prompt) return "ต้องมีโจทย์ (prompt)"

  const rawChoices = Array.isArray(q.choices) ? q.choices : []
  if (rawChoices.length < 2) return "ต้องมีตัวเลือกอย่างน้อย 2 ตัว"

  const choices: QuizChoice[] = []
  const correct: string[] = []
  for (const c of rawChoices) {
    const letter = isObject(c) ? text(c.letter) : ""
    if (!letter) return "ตัวเลือกต้องมี letter"
    if (choices.some((x) => x.letter === letter)) return `ตัวอักษรตัวเลือกซ้ำ (${letter})`
    const choiceText = text((c as Obj).text)
    if (!choiceText) return `ตัวเลือก ${letter} ไม่มีข้อความ`
    choices.push({ letter, text: choiceText })
    if ((c as Obj).correct === true) correct.push(letter)
  }
  if (correct.length !== 1) return `ต้องมีตัวเลือกที่ถูกเพียง 1 ตัว (พบ ${correct.length})`

  const code = typeof q.code === "string" && q.code.trim() ? q.code : null
  return {
    topic: text(q.topic),
    prompt,
    code,
    choices,
    correctLetter: correct[0],
    feedback: text(q.feedback),
  }
}

/** The Don't Know answer's label (ADR 0011 — fixed text in v1). */
export const DONT_KNOW_TEXT = "ไม่ทราบ / ยังไม่เคยเรียนเรื่องนี้"

/** The Don't Know answer is shown last, lettered after the final choice. */
export function dontKnowLetter(choices: QuizChoice[]): string {
  const last = choices[choices.length - 1]?.letter ?? "@"
  return String.fromCharCode(last.charCodeAt(0) + 1)
}
