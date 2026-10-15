import { type NextRequest, NextResponse } from "next/server"
import type { Queryable } from "@/lib/db"
import type { CourseKey } from "@/lib/courses/types"
import { getWeekForCourse } from "@/lib/weeks/repository"
import { getQuizForCourse } from "./repository"

export const quizNotFound = () => NextResponse.json({ error: "Not found" }, { status: 404 })

/** A positive integer id from a route param, or null. */
export function parseId(param: string): number | null {
  const id = Number(param)
  return Number.isInteger(id) && id > 0 ? id : null
}

/** The Quiz named by the `qid` route param, if it is this course's. */
export async function findQuizForCourse(db: Queryable, course: CourseKey, qid: string) {
  const id = parseId(qid)
  return id === null ? null : getQuizForCourse(db, course, id)
}

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

/** The 400 for a failed import — every per-question error, for the editor. */
export function importErrorResponse(errors: string[]): NextResponse {
  return NextResponse.json({ error: "นำเข้าไม่สำเร็จ", errors }, { status: 400 })
}
