import { NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth-guard"
import { getDb } from "@/lib/db"
import {
  listCoursesForUser,
  createCourse,
  getCourseByKey,
  assignInstructor,
} from "@/lib/courses/repository"
import { seedWeeks } from "@/lib/weeks/repository"
import { canManageCourses } from "@/lib/courses/access"
import { validateCourseInput } from "@/lib/courses/validation"
import { resolveActiveRole, type Role } from "@/lib/roles"
import { safeLog } from "@/lib/logs"

// The signed-in user's entitled courses. Entitlement follows the *active* role
// (navbar switcher), so an Admin acting as Instructor sees only the courses
// they teach; Admin → all, Instructor/TA/Student → assigned/enrolled.
export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const requestedRole = request.cookies.get("active_role")?.value as Role | undefined
  const activeRole = resolveActiveRole(user.roles as Role[], requestedRole)
  const entitlementRoles = activeRole ? [activeRole] : user.roles

  const courses = await listCoursesForUser(getDb(), user.id, entitlementRoles)
  return NextResponse.json({ courses })
}

// Create a course (Admin/Instructor only). The creator is assigned to it so it
// shows in their switcher.
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  if (!canManageCourses(user.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    code?: string
    year?: number
    semester?: number
    nameTh?: string
    nameEn?: string
    program?: string
    language?: string
  }
  const input = {
    code: (body.code ?? "").trim(),
    year: Number(body.year ?? 0),
    semester: Number(body.semester ?? 0),
    nameTh: (body.nameTh ?? "").trim(),
    nameEn: (body.nameEn ?? "").trim(),
    program: body.program?.trim() || undefined,
    language: typeof body.language === "string" ? body.language : undefined,
  }

  const { valid, errors } = validateCourseInput(input)
  if (!valid) return NextResponse.json({ errors }, { status: 400 })

  const db = getDb()
  const key = { code: input.code, year: input.year, semester: input.semester }
  if (await getCourseByKey(db, key)) {
    return NextResponse.json(
      { errors: { code: "รายวิชา (รหัส/ปี/ภาค) นี้มีอยู่แล้ว" } },
      { status: 409 }
    )
  }

  const course = await createCourse(db, {
    code: input.code,
    year: input.year,
    semester: input.semester,
    nameTh: input.nameTh,
    nameEn: input.nameEn,
    program: input.program ?? null,
    language: input.language,
  })
  await assignInstructor(db, course, user.id)
  await seedWeeks(db, course)
  await safeLog(db, {
    actorId: user.id,
    actorEmail: user.email,
    action: "course.create",
    targetEmail: course.code,
  })

  return NextResponse.json(course, { status: 201 })
}
