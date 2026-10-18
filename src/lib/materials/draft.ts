// Material Draft (#109) — the one place a Teaching Material body is validated,
// like the Syllabus Draft. The route never validates the raw body itself.

export interface MaterialDraft {
  body: string
}

export type MaterialDraftResult = { ok: true; draft: MaterialDraft } | { ok: false; errors: Record<string, string> }

export type PublishDraftResult = { ok: true; published: boolean } | { ok: false; errors: Record<string, string> }

/** The publish switch's body (#110) — `{ published: boolean }`, nothing else. */
export function buildPublishDraft(input: unknown): PublishDraftResult {
  const published =
    input !== null && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>).published : undefined
  return typeof published === "boolean"
    ? { ok: true, published }
    : { ok: false, errors: { published: "ต้องระบุว่าเผยแพร่หรือไม่" } }
}

export function buildMaterialDraft(input: unknown): MaterialDraftResult {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: { body: "ข้อมูลไม่ถูกต้อง" } }
  }
  const { body } = input as Record<string, unknown>
  if (typeof body !== "string") return { ok: false, errors: { body: "เนื้อหาต้องเป็นข้อความ" } }
  return { ok: true, draft: { body: body.trim() } }
}
