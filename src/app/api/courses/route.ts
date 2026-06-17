import { NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth-guard"
import { getDb } from "@/lib/db"
import {
  listCoursesForUser,
  createCourse,
  findCourseByCode,
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
    nameTh?: string
    nameEn?: string
    program?: string
  }
  const input = {
    code: (body.code ?? "").trim(),
    nameTh: (body.nameTh ?? "").trim(),
    nameEn: (body.nameEn ?? "").trim(),
    program: body.program?.trim() || undefined,
  }

  const { valid, errors } = validateCourseInput(input)
  if (!valid) return NextResponse.json({ errors }, { status: 400 })

  const db = getDb()
  if (await findCourseByCode(db, input.code)) {
    return NextResponse.json({ errors: { code: "รหัสวิชานี้ถูกใช้งานแล้ว" } }, { status: 409 })
  }

  const course = await createCourse(db, {
    code: input.code,
    nameTh: input.nameTh,
    nameEn: input.nameEn,
    program: input.program ?? null,
  })
  await assignInstructor(db, course.id, user.id)
  await seedWeeks(db, course.id)
  await safeLog(db, {
    actorId: user.id,
    actorEmail: user.email,
    action: "course.create",
    targetId: course.id,
  })

  return NextResponse.json(course, { status: 201 })
}
