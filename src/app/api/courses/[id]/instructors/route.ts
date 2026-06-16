import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { authorizeCourse } from "@/lib/courses/authorize"
import { listCourseInstructors, setCourseInstructors } from "@/lib/courses/repository"
import { safeLog } from "@/lib/logs"

type RouteContext = { params: Promise<{ id: string }> }

// Current staff of a course (for the assignment UI).
export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const auth = await authorizeCourse(request, id, { manage: true })
  if (!auth.ok) return auth.response

  const instructors = await listCourseInstructors(getDb(), auth.courseId)
  return NextResponse.json({ instructors })
}

// Replace the course's staff set. Admin/Instructor managers only.
export async function PUT(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const auth = await authorizeCourse(request, id, { manage: true })
  if (!auth.ok) return auth.response
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
}
