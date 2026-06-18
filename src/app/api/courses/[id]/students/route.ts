import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { courseRoute } from "@/lib/courses/route"
import { listEnrollments, listGroups } from "@/lib/enrollments/repository"
import { enrollStudent } from "@/lib/enrollments/enroll"
import { validateEnrollInput } from "@/lib/enrollments/validation"
import { safeLog } from "@/lib/logs"

const DEFAULT_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 100

function parsePositiveInt(value: string | null, fallback: number, max?: number): number {
  const n = Number.parseInt(value ?? "", 10)
  if (!Number.isFinite(n) || n < 1) return fallback
  return max ? Math.min(n, max) : n
}

// The roster of a course the caller is entitled to (Admin all; Instructor/TA
// on assigned courses).
export const GET = courseRoute({}, async (request, auth) => {
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
})

// Add (enroll) one student into the course. Instructor/Admin only.
export const POST = courseRoute({ mutate: true }, async (request, auth) => {
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
})
