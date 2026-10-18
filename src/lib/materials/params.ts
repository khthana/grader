import { NextResponse } from "next/server"
import { isPlanWeek } from "@/lib/syllabus/plan"
import { isMaterialKind, type MaterialKind } from "./kinds"

/** Where a Teaching Material lives: a Teaching Plan week number + a Material Kind (ADR 0012). */
export interface MaterialAddress {
  weekNo: number
  kind: MaterialKind
}

/** One body for every Material a viewer can't reach, so a Student can't probe what exists. */
export const materialNotFound = () => NextResponse.json({ error: "ไม่พบเอกสาร" }, { status: 404 })

/** The address as the activity log names it — `3/slides`. */
export const materialRef = ({ weekNo, kind }: MaterialAddress) => `${weekNo}/${kind}`

/** A Material's address from URL segments (`3`, `slides`), or null when malformed. */
export function parseMaterialAddress(week: string, kind: string): MaterialAddress | null {
  const weekNo = /^\d+$/.test(week) ? Number(week) : NaN
  return isPlanWeek(weekNo) && isMaterialKind(kind) ? { weekNo, kind } : null
}
