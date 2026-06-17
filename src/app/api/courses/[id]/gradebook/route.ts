import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { authorizeCourse } from "@/lib/courses/authorize"
import { getGradebook } from "@/lib/gradebook/repository"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const auth = await authorizeCourse(request, id)
  if (!auth.ok) return auth.response

  const gradebook = await getGradebook(getDb(), auth.courseId)
  return NextResponse.json({ gradebook })
}
