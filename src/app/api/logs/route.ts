import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-guard"
import { getDb } from "@/lib/db"
import { listLogs } from "@/lib/logs"

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

function parsePositiveInt(value: string | null, fallback: number, max?: number): number {
  const n = Number.parseInt(value ?? "", 10)
  if (!Number.isFinite(n) || n < 1) return fallback
  return max ? Math.min(n, max) : n
}

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request)
  if (!guard.ok) return guard.response

  const { searchParams } = new URL(request.url)
  const action = searchParams.get("action") ?? undefined
  const page = parsePositiveInt(searchParams.get("page"), 1)
  const pageSize = parsePositiveInt(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)

  const { logs, total } = await listLogs(getDb(), { action, page, pageSize })
  return NextResponse.json({ logs, total, page, pageSize })
}
