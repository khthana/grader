import { type NextRequest, NextResponse } from "next/server"
import { getDb, withTransaction } from "@/lib/db"
import { courseRoute } from "@/lib/courses/route"
import { courseSlugString } from "@/lib/courses/slug"
import { safeLog } from "@/lib/logs"
import { buildSyllabusDraft } from "@/lib/syllabus/draft"
import { getSyllabus, saveSyllabus } from "@/lib/syllabus/repository"
import { listSyllabusStaff } from "@/lib/syllabus/staff"

/** The Syllabus with its staff — anyone linked to the course (staff and Students). */
export const GET = courseRoute({}, async (_req, auth) => {
  const db = getDb()
  const [syllabus, staff] = await Promise.all([getSyllabus(db, auth.course), listSyllabusStaff(db, auth.course)])
  return NextResponse.json({ syllabus, staff })
})

/** Replace the whole Syllabus (Instructor/Admin of this course). */
export const PUT = courseRoute({ manage: true }, async (req: NextRequest, auth) => {
  const body: unknown = await req.json().catch(() => null)
  const result = buildSyllabusDraft(body)
  if (!result.ok) return NextResponse.json({ errors: result.errors }, { status: 400 })

  const syllabus = await withTransaction((tx) => saveSyllabus(tx, auth.course, result.draft, auth.user.id))
  await safeLog(getDb(), {
    actorId: auth.user.id,
    actorEmail: auth.user.email,
    action: "syllabus.update",
    targetEmail: courseSlugString(auth.course),
  })
  return NextResponse.json({ syllabus })
})
