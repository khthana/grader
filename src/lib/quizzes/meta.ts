// Quiz metadata from a request body, merged over the stored Quiz on edit
// (an omitted field keeps its value — same rule as Problem Draft, #83).
// Pure: the Week's course ownership is checked by the caller.

export interface QuizMeta {
  title: string
  description: string
  weekId: number | null
  dontKnowEnabled: boolean
}

export type QuizMetaResult = { ok: true; meta: QuizMeta } | { ok: false; error: string }

export function mergeQuizMeta(body: Record<string, unknown>, base: QuizMeta): QuizMetaResult {
  const meta = { ...base }

  if (body.title !== undefined) {
    if (typeof body.title !== "string" || !body.title.trim()) {
      return { ok: false, error: "ต้องมีชื่อแบบทดสอบ" }
    }
    meta.title = body.title.trim()
  }
  if (body.description !== undefined) {
    if (typeof body.description !== "string") return { ok: false, error: "description ต้องเป็นข้อความ" }
    meta.description = body.description.trim()
  }
  if (body.weekId !== undefined) {
    if (body.weekId !== null && !Number.isInteger(body.weekId)) {
      return { ok: false, error: "สัปดาห์ไม่ถูกต้อง" }
    }
    meta.weekId = body.weekId as number | null
  }
  if (body.dontKnowEnabled !== undefined) {
    if (typeof body.dontKnowEnabled !== "boolean") {
      return { ok: false, error: "dontKnowEnabled ต้องเป็น true/false" }
    }
    meta.dontKnowEnabled = body.dontKnowEnabled
  }
  return { ok: true, meta }
}
