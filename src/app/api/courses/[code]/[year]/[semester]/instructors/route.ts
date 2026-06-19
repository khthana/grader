import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { courseRoute } from "@/lib/courses/route"
import { listCourseInstructors, setCourseInstructors } from "@/lib/courses/repository"
import { safeLog } from "@/lib/logs"

export const GET = courseRoute({ manage: true }, async (_request, auth) => {
  const instructors = await listCourseInstructors(getDb(), auth.course)
  return NextResponse.json({ instructors })
})

export const PUT = courseRoute({ manage: true }, async (request, auth) => {
  const { user, course } = auth

  const body = (await request.json().catch(() => ({}))) as { userIds?: unknown }
  const userIds = Array.isArray(body.userIds)
    ? body.userIds.filter((n): n is number => Number.isInteger(n))
    : []

  const db = getDb()
  await setCourseInstructors(db, course, userIds)
  await safeLog(db, {
    actorId: user.id,
    actorEmail: user.email,
    action: "course.staff",
    targetEmail: course.code,
  })

  return NextResponse.json({ ok: true })
})
