import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { courseRoute } from "@/lib/courses/route"
import { isTeachingStaff } from "@/lib/courses/access"
import { listWeeks, addWeek } from "@/lib/weeks/repository"

export const GET = courseRoute({}, async (_request, auth) => {
  const onlyStudent = !isTeachingStaff(auth.user.roles)
  const weeks = await listWeeks(getDb(), auth.course, onlyStudent ? { releasedOnly: true } : undefined)
  return NextResponse.json({ weeks })
})

export const POST = courseRoute({ manage: true }, async (_request, auth) => {
  const week = await addWeek(getDb(), auth.course)
  if (!week) {
    return NextResponse.json({ error: "ครบจำนวนสัปดาห์สูงสุดแล้ว" }, { status: 409 })
  }
  return NextResponse.json({ week }, { status: 201 })
})
