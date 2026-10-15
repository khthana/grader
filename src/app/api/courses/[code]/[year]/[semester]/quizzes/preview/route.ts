import { NextResponse } from "next/server"
import { courseRoute } from "@/lib/courses/route"
import { parseQuizImport } from "@/lib/quizzes/import"
import { readJsonObject } from "@/lib/quizzes/route-helpers"

/** Parse an import JSON (`{ data }`) without saving — the editor's preview. */
export const POST = courseRoute({ manage: true }, async (req) => {
  const body = await readJsonObject(req)
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  const parsed = parseQuizImport(body.data)
  if (!parsed.ok) {
    return NextResponse.json({ error: "นำเข้าไม่สำเร็จ", errors: parsed.errors }, { status: 400 })
  }
  return NextResponse.json({ draft: parsed.draft, notices: parsed.notices })
})
