import { NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth-guard"
import { getDb } from "@/lib/db"
import { listCoursesForUser } from "@/lib/courses/repository"
import { listEnrollments, listGroups } from "@/lib/enrollments/repository"

type RouteContext = { params: Promise<{ id: string }> }

const DEFAULT_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 100

function parsePositiveInt(value: string | null, fallback: number, max?: number): number {
  const n = Number.parseInt(value ?? "", 10)
  if (!Number.isFinite(n) || n < 1) return fallback
  return max ? Math.min(n, max) : n
}

// The roster of a course the caller is entitled to (Admin all; Instructor/TA
// on assigned courses).
export async function GET(request: NextRequest, context: RouteContext) {
  const user = await getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { id } = await context.params
  const courseId = Number.parseInt(id, 10)
  if (!Number.isFinite(courseId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const db = getDb()
  const entitled = await listCoursesForUser(db, user.id, user.roles)
  if (!entitled.some((c) => c.id === courseId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const search = searchParams.get("search") ?? ""
  const group = searchParams.get("group") ?? ""
  const page = parsePositiveInt(searchParams.get("page"), 1)
  const pageSize = parsePositiveInt(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)

  const { enrollments, total } = await listEnrollments(db, {
    courseId,
    search,
    group,
    page,
    pageSize,
  })
  const groups = await listGroups(db, courseId)
  return NextResponse.json({ enrollments, total, page, pageSize, groups })
}
