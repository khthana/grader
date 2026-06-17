import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { authorizeCourse } from "@/lib/courses/authorize"
import { updateWeekTopic } from "@/lib/weeks/repository"

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
