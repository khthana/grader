import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { authorizeCourse } from "@/lib/courses/authorize"
import { listWeeks, addWeek } from "@/lib/weeks/repository"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const auth = await authorizeCourse(request, id)
  if (!auth.ok) return auth.response

  const weeks = await listWeeks(getDb(), auth.courseId)
  return NextResponse.json({ weeks })
}

// Append one week to the course (Admin/Instructor only). 409 once the course
// already holds MAX_WEEKS weeks.
export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const auth = await authorizeCourse(request, id, { manage: true })
  if (!auth.ok) return auth.response

  const week = await addWeek(getDb(), auth.courseId)
  if (!week) {
    return NextResponse.json({ error: "ครบจำนวนสัปดาห์สูงสุดแล้ว" }, { status: 409 })
  }
  return NextResponse.json({ week }, { status: 201 })
}
