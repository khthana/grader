import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { authorizeCourse } from "@/lib/courses/authorize"
import {
  updateWeekTopic,
  listWeeks,
  weekHasProblems,
  deleteWeek,
} from "@/lib/weeks/repository"

type RouteContext = { params: Promise<{ id: string; wid: string }> }

export async function PUT(request: NextRequest, context: RouteContext) {
  const { id, wid } = await context.params
  const auth = await authorizeCourse(request, id, { manage: true })
  if (!auth.ok) return auth.response

  const weekId = Number.parseInt(wid, 10)
  if (!Number.isFinite(weekId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const body = (await request.json().catch(() => ({}))) as { topic?: string }
  const topic = (body.topic ?? "").trim()
  if (!topic) {
    return NextResponse.json({ error: "topic is required" }, { status: 400 })
  }

  const week = await updateWeekTopic(getDb(), weekId, topic)
  if (!week) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json({ week })
}

// Remove a week (Admin/Instructor only). Only the *last* week may be removed,
// it must hold no problems, and a course must keep at least one week — this
// avoids cascade-deleting problems and keeps week_no contiguous.
export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id, wid } = await context.params
  const auth = await authorizeCourse(request, id, { manage: true })
  if (!auth.ok) return auth.response

  const weekId = Number.parseInt(wid, 10)
  if (!Number.isFinite(weekId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const db = getDb()
  const weeks = await listWeeks(db, auth.courseId)
  const target = weeks.find((w) => w.id === weekId)
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (weeks.length <= 1) {
    return NextResponse.json({ error: "ต้องมีอย่างน้อย 1 สัปดาห์" }, { status: 409 })
  }
  const lastWeek = weeks[weeks.length - 1]
  if (target.weekNo !== lastWeek.weekNo) {
    return NextResponse.json({ error: "ลบได้เฉพาะสัปดาห์สุดท้าย" }, { status: 409 })
  }
  if (await weekHasProblems(db, weekId)) {
    return NextResponse.json({ error: "สัปดาห์นี้มีโจทย์อยู่ ลบไม่ได้" }, { status: 409 })
  }

  await deleteWeek(db, weekId)
  return NextResponse.json({ ok: true })
}
