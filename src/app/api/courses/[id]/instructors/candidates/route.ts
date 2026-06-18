import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { courseRoute } from "@/lib/courses/route"
import { searchStaffCandidates } from "@/lib/courses/repository"

export const GET = courseRoute({ manage: true }, async (request, _auth) => {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get("search") ?? ""
  const candidates = await searchStaffCandidates(getDb(), search)
  return NextResponse.json({ candidates })
})
