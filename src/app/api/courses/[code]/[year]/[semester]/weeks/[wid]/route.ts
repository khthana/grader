import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { courseRoute } from "@/lib/courses/route"
import {
  updateWeekTopic,
  setWeekReleased,
  listWeeks,
  weekHasProblems,
  deleteWeek,
} from "@/lib/weeks/repository"

export const PUT = courseRoute<{ code: string; year: string; semester: string; wid: string }>(
  { manage: true },
  async (request, _auth, { wid }) => {
    const weekId = Number.parseInt(wid, 10)
    if (!Number.isFinite(weekId)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const body = (await request.json().catch(() => ({}))) as {
      topic?: string
      isReleased?: boolean
    }
    const hasTopic = typeof body.topic === "string" && body.topic.trim().length > 0
    const hasReleased = typeof body.isReleased === "boolean"

    if (!hasTopic && !hasReleased) {
      return NextResponse.json({ error: "topic or isReleased is required" }, { status: 400 })
    }

    const db = getDb()
    let week = null

    if (hasTopic) {
      week = await updateWeekTopic(db, weekId, body.topic!.trim())
      if (!week) return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    if (hasReleased) {
      week = await setWeekReleased(db, weekId, body.isReleased!)
      if (!week) return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({ week })
  }
)

export const DELETE = courseRoute<{ code: string; year: string; semester: string; wid: string }>(
  { manage: true },
  async (_request, auth, { wid }) => {
    const weekId = Number.parseInt(wid, 10)
    if (!Number.isFinite(weekId)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const db = getDb()
    const weeks = await listWeeks(db, auth.course)
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
)
