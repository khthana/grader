import { isPlanWeek } from "@/lib/syllabus/plan"
import { isMaterialKind, type MaterialKind } from "./kinds"

/** Where a Teaching Material lives: a Teaching Plan week number + a Material Kind (ADR 0012). */
export interface MaterialAddress {
  weekNo: number
  kind: MaterialKind
}

/** A Material's address from URL segments (`3`, `slides`), or null when malformed. */
export function parseMaterialAddress(week: string, kind: string): MaterialAddress | null {
  const weekNo = /^\d+$/.test(week) ? Number(week) : NaN
  return isPlanWeek(weekNo) && isMaterialKind(kind) ? { weekNo, kind } : null
}
