import { NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth-guard"
import { getDb } from "@/lib/db"
import { listCoursesForUser } from "@/lib/courses/repository"
import { canMutateRoster } from "@/lib/courses/access"
import { listEnrollments, listGroups } from "@/lib/enrollments/repository"
import { enrollStudent } from "@/lib/enrollments/enroll"
import { validateEnrollInput } from "@/lib/enrollments/validation"
import { safeLog } from "@/lib/logs"
import type { UserWithRoles } from "@/lib/users/repository"

type RouteContext = { params: Promise<{ id: string }> }

const DEFAULT_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 100

function parsePositiveInt(value: string | null, fallback: number, max?: number): number {
  const n = Number.parseInt(value ?? "", 10)
  if (!Number.isFinite(n) || n < 1) return fallback
  return max ? Math.min(n, max) : n
}

type Authorized =
  | { ok: true; user: UserWithRoles; courseId: number }
  | { ok: false; response: NextResponse }

// Resolve + authorize a course request: 401 unauthenticated, 404 bad id,
// 403 when the course isn't in the caller's entitled set (or, when `mutate`,
// when the caller is read-only on rosters, e.g. a TA).
async function authorizeCourse(
  request: NextRequest,
  context: RouteContext,
  options: { mutate?: boolean } = {}
): Promise<Authorized> {
  const user = await getUserFromRequest(request)
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) }
  }

  const { id } = await context.params
  const courseId = Number.parseInt(id, 10)
  if (!Number.isFinite(courseId)) {
    return { ok: false, response: NextResponse.json({ error: "Not found" }, { status: 404 }) }
  }

  const entitled = await listCoursesForUser(getDb(), user.id, user.roles)
  if (!entitled.some((c) => c.id === courseId)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  if (options.mutate && !canMutateRoster(user.roles)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return { ok: true, user, courseId }
}

// The roster of a course the caller is entitled to (Admin all; Instructor/TA
// on assigned courses).
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await authorizeCourse(request, context)
  if (!auth.ok) return auth.response
  const { courseId } = auth

  const db = getDb()
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

// Add (enroll) one student into the course. Instructor/Admin only.
export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await authorizeCourse(request, context, { mutate: true })
  if (!auth.ok) return auth.response
  const { user, courseId } = auth

  const body = (await request.json().catch(() => ({}))) as {
    idCode?: string
    titleTh?: string
    firstNameTh?: string
    lastNameTh?: string
    email?: string
    studyGroup?: string
    program?: string
    year?: string
  }

  const { valid, errors } = validateEnrollInput({
    idCode: body.idCode ?? "",
    firstNameTh: body.firstNameTh ?? "",
    lastNameTh: body.lastNameTh ?? "",
    email: body.email,
  })
  if (!valid) return NextResponse.json({ errors }, { status: 400 })

  const db = getDb()
  const result = await enrollStudent(db, courseId, {
    idCode: body.idCode!,
    titleTh: body.titleTh,
    firstNameTh: body.firstNameTh!,
    lastNameTh: body.lastNameTh!,
    email: body.email,
    studyGroup: body.studyGroup,
    program: body.program,
    year: body.year,
  })

  if (!result.ok) {
    return NextResponse.json({ error: "รหัสนี้อยู่ในรายวิชาแล้ว" }, { status: 409 })
  }

  await safeLog(db, {
    actorId: user.id,
    actorEmail: user.email,
    action: "enrollment.add",
    targetId: result.userId,
  })

  return NextResponse.json({ ok: true, created: result.created }, { status: 201 })
}
