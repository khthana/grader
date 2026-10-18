// Materials Student View (#109, #110) — the one module for
// what a Student sees of Teaching Materials, in the spirit of the Problem
// Student View (#84). Callers pass the viewer's course access and never redact
// inline. Staff see everything; a Student sees only Published Materials of
// planned weeks, without the published flag.

import type { MaterialsOutline, OutlineMaterial } from "./outline"
import type { Material } from "./repository"

export interface MaterialViewer {
  staff: boolean
}

export function canSeeMaterial(viewer: MaterialViewer, material: { isPublished: boolean }, planned: boolean): boolean {
  return viewer.staff || (material.isPublished && planned)
}

export type StudentOutlineMaterial = Omit<OutlineMaterial, "isPublished">

/** A Material as a viewer reads it (a Student's carries no published flag). */
export type ViewedMaterial = Material | Omit<Material, "isPublished">

/** A Material as this viewer reads it — a Student never gets the published flag. */
export function materialFor<M extends { isPublished: boolean }>(viewer: MaterialViewer, material: M): M | Omit<M, "isPublished"> {
  if (viewer.staff) return material
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { isPublished, ...rest } = material
  return rest
}

/** The outline as this viewer reads it — a Student's holds only what they may see, without the flag. */
export function materialsOutlineFor<M extends { isPublished: boolean }>(
  viewer: MaterialViewer,
  outline: MaterialsOutline<M>
): MaterialsOutline<M> | MaterialsOutline<Omit<M, "isPublished">> {
  if (viewer.staff) return outline
  const weeks = outline.weeks.flatMap((week) => {
    const materials = Object.fromEntries(
      Object.entries(week.materials)
        .filter(([, m]) => canSeeMaterial(viewer, m, true))
        .map(([kind, m]) => [kind, materialFor(viewer, m)])
    )
    return Object.keys(materials).length === 0 ? [] : [{ ...week, materials }]
  })
  return { weeks, unplanned: [] }
}
