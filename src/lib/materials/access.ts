// What a viewer reads of Teaching Materials (#109) — the outline and the
// single-Material gate, shared by the API routes and the pages so the two
// can't drift. Shaping is the Student View's; this only loads and asks it.

import type { Queryable } from "@/lib/db"
import type { CourseKey } from "@/lib/courses/types"
import { getSyllabus } from "@/lib/syllabus/repository"
import type { MaterialAddress } from "./params"
import { buildMaterialsOutline, materialHeading } from "./outline"
import { getMaterial, listMaterials } from "./repository"
import { canSeeMaterial, materialFor, materialsOutlineFor, type MaterialViewer, type ViewedMaterial } from "./student-view"

/** The viewer's outline, plus whether the course has a Teaching Plan at all. */
export async function loadMaterialsOutline(db: Queryable, key: CourseKey, viewer: MaterialViewer) {
  const [{ plan }, materials] = await Promise.all([getSyllabus(db, key), listMaterials(db, key)])
  const summaries = materials.map(({ weekNo, kind, isPublished }) => ({ weekNo, kind, isPublished }))
  return { outline: materialsOutlineFor(viewer, buildMaterialsOutline(plan, summaries)), hasPlan: plan.length > 0 }
}

/**
 * One Material with its live heading (null = Unplanned). `exists` says whether
 * there is one at all; `material` is set only when the viewer may see it —
 * callers answer a refused one exactly as a missing one.
 */
export async function loadMaterial(
  db: Queryable,
  key: CourseKey,
  address: MaterialAddress,
  viewer: MaterialViewer
): Promise<{ exists: boolean; material: ViewedMaterial | null; heading: string | null }> {
  const [material, { plan }] = await Promise.all([getMaterial(db, key, address.weekNo, address.kind), getSyllabus(db, key)])
  const heading = materialHeading(plan, address.weekNo)
  const visible = material !== null && canSeeMaterial(viewer, material, heading !== null)
  return { exists: material !== null, material: visible ? materialFor(viewer, material) : null, heading }
}
