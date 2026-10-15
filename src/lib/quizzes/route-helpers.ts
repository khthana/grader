import { type NextRequest, NextResponse } from "next/server"
import type { Queryable } from "@/lib/db"
import type { CourseKey } from "@/lib/courses/types"
import { getWeekForCourse } from "@/lib/weeks/repository"

/** The request body as a plain object, or null when it isn't one. */
export async function readJsonObject(req: NextRequest): Promise<Record<string, unknown> | null> {
  const body: unknown = await req.json().catch(() => null)
  return typeof body === "object" && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : null
}

/**
 * A 400 unless `weekId` is null or a Week of this course — the single-column
 * week FK would accept any course's Week (cf. #88).
 */
export async function checkQuizWeek(
  db: Queryable,
  course: CourseKey,
  weekId: number | null
): Promise<NextResponse | null> {
  if (weekId === null) return null
  if (await getWeekForCourse(db, course, weekId)) return null
  return NextResponse.json({ error: "ไม่พบสัปดาห์นี้ในรายวิชา" }, { status: 400 })
}
