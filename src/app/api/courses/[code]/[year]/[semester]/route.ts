import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { courseRoute } from "@/lib/courses/route"
import { updateCourse, deleteCourse, getCourseCascadeCounts } from "@/lib/courses/repository"
import { canChangeCourseLanguage } from "@/lib/courses/access"
import { isSupportedLanguage } from "@/lib/languages"
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
    language?: string
  }
  const nameTh = (body.nameTh ?? "").trim()
  const nameEn = (body.nameEn ?? "").trim()
  if (!nameTh || !nameEn) {
    return NextResponse.json({ errors: { nameTh: !nameTh ? "required" : undefined, nameEn: !nameEn ? "required" : undefined } }, { status: 400 })
  }

  const db = getDb()

  // Language is optional. When supplied it must be a supported language, and
  // may only differ from the stored value while the course has no problems
  // (problems inherit the language at creation — #63). A name-only edit sends
  // the current language, so it never trips the lock.
  const language = typeof body.language === "string" ? body.language : undefined
  if (language !== undefined) {
    if (!isSupportedLanguage(language)) {
      return NextResponse.json({ errors: { language: "ภาษาที่เลือกไม่รองรับ" } }, { status: 400 })
    }
    const { problems } = await getCourseCascadeCounts(db, course)
    if (!canChangeCourseLanguage({ current: course.language, desired: language, problemCount: problems })) {
      return NextResponse.json(
        { errors: { language: "เปลี่ยนภาษาไม่ได้เมื่อรายวิชามีโจทย์อยู่แล้ว" } },
        { status: 409 }
      )
    }
  }

  const updated = await updateCourse(db, course, {
    nameTh,
    nameEn,
    program: body.program?.trim() || null,
    language,
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
