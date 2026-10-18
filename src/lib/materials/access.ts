// What a viewer reads of Teaching Materials (#109) — the outline and the
// single-Material gate, shared by the API routes and the pages so the two
// can't drift. Shaping is the Student View's; this only loads and asks it.

import type { Queryable } from "@/lib/db"
import type { CourseKey } from "@/lib/courses/types"
import { getSyllabus } from "@/lib/syllabus/repository"
import type { PlanEntry } from "@/lib/syllabus/plan"
import { materialRef, type MaterialAddress } from "./params"
import { buildMaterialsOutline, materialHeading, type OutlineAttachment, type OutlineMaterial } from "./outline"
import { getMaterial, listMaterials } from "./repository"
import { getAttachmentForCourse, listAttachments, listCourseAttachments, type Attachment, type StoredAttachment } from "./attachments/repository"
import { canSeeMaterial, materialFor, materialsOutlineFor, type MaterialViewer, type ViewedMaterial } from "./student-view"

/** The viewer's outline, plus whether the course has a Teaching Plan at all. */
export async function loadMaterialsOutline(db: Queryable, key: CourseKey, viewer: MaterialViewer) {
  const [{ plan }, materials, attachments] = await Promise.all([
    getSyllabus(db, key),
    listMaterials(db, key),
    listCourseAttachments(db, key),
  ])
  const byMaterial = new Map<string, OutlineAttachment[]>()
  for (const { weekNo, kind, ...attachment } of attachments) {
    const at = materialRef({ weekNo, kind })
    byMaterial.set(at, [...(byMaterial.get(at) ?? []), attachment])
  }
  const shown = materials.map(
    ({ weekNo, kind, body, isPublished }): OutlineMaterial => ({
      weekNo,
      kind,
      isPublished,
      hasText: body.trim() !== "", // saved bodies are trimmed; this also covers older rows
      attachments: byMaterial.get(materialRef({ weekNo, kind })) ?? [],
    })
  )
  return { outline: materialsOutlineFor(viewer, buildMaterialsOutline(plan, shown)), hasPlan: plan.length > 0 }
}

/**
 * One Material with its live heading (null = Unplanned) and its Attachments
 * (#114). `exists` says whether there is one at all; `material` is set only
 * when the viewer may see it, and `attachments` is empty unless it is —
 * callers answer a refused one exactly as a missing one.
 */
export async function loadMaterial(
  db: Queryable,
  key: CourseKey,
  address: MaterialAddress,
  viewer: MaterialViewer
): Promise<{ exists: boolean; material: ViewedMaterial | null; heading: string | null; attachments: Attachment[] }> {
  const [material, { plan }] = await Promise.all([getMaterial(db, key, address.weekNo, address.kind), getSyllabus(db, key)])
  const heading = materialHeading(plan, address.weekNo)
  const visible = material !== null && isVisible(viewer, material, plan)
  return {
    exists: material !== null,
    material: visible ? materialFor(viewer, material) : null,
    heading,
    attachments: visible ? await listAttachments(db, key, address) : [],
  }
}

/**
 * One Attachment for this viewer (#114) — seen exactly when its Teaching
 * Material is (ADR 0013). Null for one that isn't this course's or that the
 * viewer may not see: callers answer both alike.
 */
export async function loadAttachment(
  db: Queryable,
  key: CourseKey,
  attachmentId: number,
  viewer: MaterialViewer
): Promise<StoredAttachment | null> {
  const attachment = await getAttachmentForCourse(db, key, attachmentId)
  if (!attachment) return null
  const { plan } = await getSyllabus(db, key)
  return isVisible(viewer, attachment.material, plan) ? attachment : null
}

/** The Student View's rule, with "planned" read from the course's Teaching Plan. */
const isVisible = (viewer: MaterialViewer, material: { weekNo: number; isPublished: boolean }, plan: PlanEntry[]) =>
  canSeeMaterial(viewer, material, materialHeading(plan, material.weekNo) !== null)
