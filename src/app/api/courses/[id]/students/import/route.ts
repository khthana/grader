import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { courseRoute } from "@/lib/courses/route"
import { validateRosterRows, type RawRosterRow } from "@/lib/enrollments/import"
import { enrollStudent } from "@/lib/enrollments/enroll"
import { safeLog } from "@/lib/logs"

type RowStatus = "created" | "enrolled" | "skipped" | "error"

interface RowResult {
  row: number
  status: RowStatus
  idCode: string
  errors?: Record<string, string>
}

// Bulk-enroll a roster from parsed spreadsheet rows. Each valid row runs through
// the enroll service (same find-or-create / email-derivation / program-inherit
// rules as single add). Bad rows never block good ones.
export const POST = courseRoute({ mutate: true }, async (request, auth) => {
  const { user, courseId } = auth

  const body = (await request.json().catch(() => ({}))) as { rows?: RawRosterRow[] }
  const rows = Array.isArray(body.rows) ? body.rows : []
  const validation = validateRosterRows(rows)

  const db = getDb()
  const results: RowResult[] = []

  for (const r of validation) {
    if (!r.valid || !r.input) {
      results.push({
        row: r.row,
        status: "error",
        idCode: r.input?.idCode ?? "",
        errors: r.errors,
      })
      continue
    }

    const outcome = await enrollStudent(db, courseId, r.input)
    if (!outcome.ok) {
      results.push({ row: r.row, status: "skipped", idCode: r.input.idCode })
    } else {
      results.push({
        row: r.row,
        status: outcome.created ? "created" : "enrolled",
        idCode: r.input.idCode,
      })
    }
  }

  const count = (s: RowStatus) => results.filter((r) => r.status === s).length
  await safeLog(db, {
    actorId: user.id,
    actorEmail: user.email,
    action: "enrollment.import",
  })

  return NextResponse.json({
    results,
    created: count("created"),
    enrolled: count("enrolled"),
    skipped: count("skipped"),
    failed: count("error"),
  })
})
