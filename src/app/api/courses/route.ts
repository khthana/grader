import { NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth-guard"
import { getDb } from "@/lib/db"
import { listCoursesForUser } from "@/lib/courses/repository"

// The signed-in user's entitled courses (Admin → all; Instructor/TA → assigned).
export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const courses = await listCoursesForUser(getDb(), user.id, user.roles)
  return NextResponse.json({ courses })
}
