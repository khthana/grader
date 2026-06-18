import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { courseRoute } from "@/lib/courses/route"
import { listCourseInstructors, setCourseInstructors } from "@/lib/courses/repository"
import { safeLog } from "@/lib/logs"

// Current staff of a course (for the assignment UI).
export const GET = courseRoute({ manage: true }, async (_request, auth) => {
  const instructors = await listCourseInstructors(getDb(), auth.courseId)
  return NextResponse.json({ instructors })
})

// Replace the course's staff set. Admin/Instructor managers only.
export const PUT = courseRoute({ manage: true }, async (request, auth) => {
  const { user, courseId } = auth

  const body = (await request.json().catch(() => ({}))) as { userIds?: unknown }
  const userIds = Array.isArray(body.userIds)
    ? body.userIds.filter((n): n is number => Number.isInteger(n))
    : []

  const db = getDb()
  await setCourseInstructors(db, courseId, userIds)
  await safeLog(db, {
    actorId: user.id,
    actorEmail: user.email,
    action: "course.staff",
    targetId: courseId,
  })

  return NextResponse.json({ ok: true })
})
