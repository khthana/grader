// Syllabus Draft (#99) — the one place a Syllabus body is validated and
// normalized, like the Problem Draft (#83). The route never validates the raw
// body itself; what comes out here is exactly what gets written.

/** A Course offering's Syllabus as stored (staff are read live, never stored). */
export interface Syllabus {
  credits: string
  description: string
  objectives: string
}

export const EMPTY_SYLLABUS: Syllabus = { credits: "", description: "", objectives: "" }

const TEXT_FIELDS = ["credits", "description", "objectives"] as const

export type SyllabusDraftResult =
  | { ok: true; draft: Syllabus }
  | { ok: false; errors: Record<string, string> }

// A PUT replaces the whole Syllabus, so a field left out is cleared. A
// wrong-typed field is a field error (a 400), never a crash further down.
export function buildSyllabusDraft(body: unknown): SyllabusDraftResult {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, errors: { body: "ข้อมูลไม่ถูกต้อง" } }
  }
  const input = body as Record<string, unknown>
  const errors: Record<string, string> = {}
  const draft = { ...EMPTY_SYLLABUS }
  for (const key of TEXT_FIELDS) {
    const value = input[key]
    if (value == null) continue
    if (typeof value !== "string") errors[key] = `${key} ต้องเป็นข้อความ`
    else draft[key] = value.trim()
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, draft }
}

/** Nothing written yet — viewers see "ยังไม่มีประมวลรายวิชา". */
export function isSyllabusEmpty(syllabus: Syllabus): boolean {
  return TEXT_FIELDS.every((key) => syllabus[key] === "")
}
