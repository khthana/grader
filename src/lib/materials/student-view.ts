// Materials Student View (#109, #110) — the one module for
// what a Student sees of Teaching Materials, in the spirit of the Problem
// Student View (#84). Callers pass the viewer's course access and never redact
// inline. Staff see everything; a Student sees only Published Materials of
// planned weeks, without the published flag.

import type { MaterialsOutline, MaterialSummary } from "./outline"
import type { Material } from "./repository"

export interface MaterialViewer {
  staff: boolean
}

export function canSeeMaterial(viewer: MaterialViewer, material: { isPublished: boolean }, planned: boolean): boolean {
  return viewer.staff || (material.isPublished && planned)
}

export type StudentMaterialSummary = Omit<MaterialSummary, "isPublished">

/** A Material as a viewer reads it (a Student's carries no published flag). */
export type ViewedMaterial = Material | Omit<Material, "isPublished">

/** A Material as this viewer reads it — a Student never gets the published flag. */
export function materialFor<M extends { isPublished: boolean }>(viewer: MaterialViewer, material: M): M | Omit<M, "isPublished"> {
  if (viewer.staff) return material
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { isPublished, ...rest } = material
  return rest
}

export function materialsOutlineFor(
  viewer: MaterialViewer,
  outline: MaterialsOutline
): MaterialsOutline | MaterialsOutline<StudentMaterialSummary> {
  if (viewer.staff) return outline
  const weeks = outline.weeks.flatMap((week) => {
    const materials = Object.fromEntries(
      Object.entries(week.materials)
        .filter(([, m]) => canSeeMaterial(viewer, m, true))
        .map(([kind, m]) => [kind, { weekNo: m.weekNo, kind: m.kind }])
    )
    return Object.keys(materials).length === 0 ? [] : [{ ...week, materials }]
  })
  return { weeks, unplanned: [] }
}
