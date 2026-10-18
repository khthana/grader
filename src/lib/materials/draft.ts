// Material Draft (#109) — the one place a Teaching Material body is validated,
// like the Syllabus Draft. The route never validates the raw body itself.

export interface MaterialDraft {
  body: string
}

export type MaterialDraftResult = { ok: true; draft: MaterialDraft } | { ok: false; errors: Record<string, string> }

export function buildMaterialDraft(input: unknown): MaterialDraftResult {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: { body: "ข้อมูลไม่ถูกต้อง" } }
  }
  const { body } = input as Record<string, unknown>
  if (typeof body !== "string") return { ok: false, errors: { body: "เนื้อหาต้องเป็นข้อความ" } }
  return { ok: true, draft: { body: body.trim() } }
}
