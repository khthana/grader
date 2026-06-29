import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { courseRoute } from "@/lib/courses/route"
import { updateCourse, deleteCourse, getCourseCascadeCounts } from "@/lib/courses/repository"
import { safeLog } from "@/lib/logs"

export const GET = courseRoute({ manage: true }, async (_request, auth) => {
  const db = getDb()
  const counts = await getCourseCascadeCounts(db, auth.course)
  return NextResponse.json({ ...auth.course, counts })
})

export const PUT = courseRoute({ manage: true }, async (request, auth) => {
  const { user, course } = auth

  const body = (await request.json().catch(() => ({}))) as {
    nameTh?: string
    nameEn?: string
    program?: string
  }
  const nameTh = (body.nameTh ?? "").trim()
  const nameEn = (body.nameEn ?? "").trim()
  if (!nameTh || !nameEn) {
    return NextResponse.json({ errors: { nameTh: !nameTh ? "required" : undefined, nameEn: !nameEn ? "required" : undefined } }, { status: 400 })
  }

  const db = getDb()
  const updated = await updateCourse(db, course, {
    nameTh,
    nameEn,
    program: body.program?.trim() || null,
  })
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await safeLog(db, {
    actorId: user.id,
    actorEmail: user.email,
    action: "course.update",
    targetEmail: course.code,
  })
  return NextResponse.json(updated)
})

export const DELETE = courseRoute({ manage: true }, async (_request, auth) => {
  const { user, course } = auth

  const db = getDb()
  const ok = await deleteCourse(db, course)
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await safeLog(db, {
    actorId: user.id,
    actorEmail: user.email,
    action: "course.delete",
    targetEmail: course.code,
  })
  return NextResponse.json({ ok: true })
})
