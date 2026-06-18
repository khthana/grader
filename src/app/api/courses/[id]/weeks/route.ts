import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { courseRoute } from "@/lib/courses/route"
import { listWeeks, addWeek } from "@/lib/weeks/repository"

export const GET = courseRoute({}, async (_request, auth) => {
  const weeks = await listWeeks(getDb(), auth.courseId)
  return NextResponse.json({ weeks })
})

// Append one week to the course (Admin/Instructor only). 409 once the course
// already holds MAX_WEEKS weeks.
export const POST = courseRoute({ manage: true }, async (_request, auth) => {
  const week = await addWeek(getDb(), auth.courseId)
  if (!week) {
    return NextResponse.json({ error: "ครบจำนวนสัปดาห์สูงสุดแล้ว" }, { status: 409 })
  }
  return NextResponse.json({ week }, { status: 201 })
})
