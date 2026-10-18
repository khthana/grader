// Materials outline (#109, ADR 0012) — the one rule for "which week, under
// which heading, planned or not". A Teaching Material keeps its own week
// number; its heading is that week's Teaching Plan topics, read live, and a
// week the plan no longer has makes it Unplanned. Nothing here is stored.

import type { PlanEntry } from "@/lib/syllabus/plan"
import { MATERIAL_KINDS, type MaterialKind } from "./kinds"

/** What an outline needs of a Teaching Material (no body). */
export interface MaterialSummary {
  weekNo: number
  kind: MaterialKind
  isPublished: boolean
}

export interface OutlineWeek<M> {
  weekNo: number
  heading: string
  materials: Partial<Record<MaterialKind, M>>
}

export interface MaterialsOutline<M = MaterialSummary> {
  /** The distinct Teaching Plan week numbers, in order. */
  weeks: OutlineWeek<M>[]
  /** Materials whose week isn't in the Teaching Plan, by week then Kind. */
  unplanned: M[]
}

/** The week's Teaching Plan topics in plan order, or null when the plan has no such week. */
export function materialHeading(plan: PlanEntry[], weekNo: number): string | null {
  const topics = plan.filter((e) => e.weekNo === weekNo).map((e) => e.topic)
  return topics.length === 0 ? null : topics.join(" · ")
}

export function buildMaterialsOutline<M extends { weekNo: number; kind: MaterialKind }>(
  plan: PlanEntry[],
  materials: M[]
): MaterialsOutline<M> {
  const weekNos = [...new Set(plan.map((e) => e.weekNo))].sort((a, b) => a - b)
  const weeks = weekNos.map((weekNo): OutlineWeek<M> => ({
    weekNo,
    heading: materialHeading(plan, weekNo) ?? "",
    materials: {},
  }))
  const byWeek = new Map(weeks.map((w) => [w.weekNo, w]))

  const unplanned: M[] = []
  for (const m of materials) {
    const week = byWeek.get(m.weekNo)
    if (week) week.materials[m.kind] = m
    else unplanned.push(m)
  }
  const kindOrder = (kind: MaterialKind) => MATERIAL_KINDS.indexOf(kind)
  unplanned.sort((a, b) => a.weekNo - b.weekNo || kindOrder(a.kind) - kindOrder(b.kind))
  return { weeks, unplanned }
}
