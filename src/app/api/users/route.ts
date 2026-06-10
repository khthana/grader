import { NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth-guard"
import { getDb } from "@/lib/db"
import { listUsers } from "@/lib/users/repository"

const DEFAULT_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 100

function parsePositiveInt(value: string | null, fallback: number, max?: number): number {
  const n = Number.parseInt(value ?? "", 10)
  if (!Number.isFinite(n) || n < 1) return fallback
  return max ? Math.min(n, max) : n
}

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  if (!user.roles.includes("Admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const search = searchParams.get("search") ?? ""
  const page = parsePositiveInt(searchParams.get("page"), 1)
  const pageSize = parsePositiveInt(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)

  const { users, total } = await listUsers(getDb(), { search, page, pageSize })
  return NextResponse.json({ users, total, page, pageSize })
}
