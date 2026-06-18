import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { courseRoute } from "@/lib/courses/route"
import {
  getCourseById,
  updateCourse,
  deleteCourse,
  findCourseByCode,
} from "@/lib/courses/repository"
import { validateCourseInput } from "@/lib/courses/validation"
import { safeLog } from "@/lib/logs"

// Course detail (for the edit form). Entitled course managers only.
export const GET = courseRoute({ manage: true }, async (_request, auth) => {
  const course = await getCourseById(getDb(), auth.courseId)
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(course)
})

// Edit a course.
export const PUT = courseRoute({ manage: true }, async (request, auth) => {
  const { user, courseId } = auth

  const body = (await request.json().catch(() => ({}))) as {
    code?: string
    nameTh?: string
    nameEn?: string
    program?: string
  }
  const input = {
    code: (body.code ?? "").trim(),
    nameTh: (body.nameTh ?? "").trim(),
    nameEn: (body.nameEn ?? "").trim(),
    program: body.program?.trim() || undefined,
  }

  const { valid, errors } = validateCourseInput(input)
  if (!valid) return NextResponse.json({ errors }, { status: 400 })

  const db = getDb()
  const clash = await findCourseByCode(db, input.code)
  if (clash && clash.id !== courseId) {
    return NextResponse.json({ errors: { code: "รหัสวิชานี้ถูกใช้งานแล้ว" } }, { status: 409 })
  }

  const updated = await updateCourse(db, courseId, {
    code: input.code,
    nameTh: input.nameTh,
    nameEn: input.nameEn,
    program: input.program ?? null,
  })
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await safeLog(db, {
    actorId: user.id,
    actorEmail: user.email,
    action: "course.update",
    targetId: courseId,
  })
  return NextResponse.json(updated)
})

// Delete a course (cascades enrollments + instructor assignments via FK).
export const DELETE = courseRoute({ manage: true }, async (_request, auth) => {
  const { user, courseId } = auth

  const db = getDb()
  const ok = await deleteCourse(db, courseId)
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await safeLog(db, {
    actorId: user.id,
    actorEmail: user.email,
    action: "course.delete",
    targetId: courseId,
  })
  return NextResponse.json({ ok: true })
})
