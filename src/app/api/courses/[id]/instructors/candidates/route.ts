import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { authorizeCourse } from "@/lib/courses/authorize"
import { searchStaffCandidates } from "@/lib/courses/repository"

type RouteContext = { params: Promise<{ id: string }> }

// Instructor/TA users eligible to be assigned as course staff. Manage-gated so
// course managers (not just Admins) can search candidates.
export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const auth = await authorizeCourse(request, id, { manage: true })
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const search = searchParams.get("search") ?? ""
  const candidates = await searchStaffCandidates(getDb(), search)
  return NextResponse.json({ candidates })
}
