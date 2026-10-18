"use client"

import { useState } from "react"
import Link from "next/link"
import { FaArrowLeft, FaEdit, FaEye, FaEyeSlash } from "react-icons/fa"
import { useUnsavedChangesGuard } from "@/components/shell/NavigationGuard"
import { useToast } from "@/components/shell/ToastProvider"
import { MarkdownContent } from "@/components/ui/MarkdownContent"
import { MarkdownField } from "@/components/ui/MarkdownField"
import { materialKindLabel, type MaterialKind } from "@/lib/materials/kinds"
import type { ViewedMaterial } from "@/lib/materials/student-view"
import { UnpublishedBadge } from "./MaterialsOutline"

/**
 * One Teaching Material (#109): view mode for everyone who may see it; a course
 * manager writes its Markdown body. A Material not yet written opens straight
 * in edit mode for a manager — the first save creates it.
 */
export function MaterialPanel({
  courseSlug,
  coursePath,
  weekNo,
  kind,
  heading,
  initialMaterial,
  canEdit,
  staff,
}: {
  courseSlug: string
  coursePath: string
  weekNo: number
  kind: MaterialKind
  /** The week's Teaching Plan topics; null = Unplanned. */
  heading: string | null
  initialMaterial: ViewedMaterial | null
  canEdit: boolean
  staff: boolean
}) {
  const { notify } = useToast()
  const [material, setMaterial] = useState(initialMaterial)
  const [draft, setDraft] = useState<string | null>(initialMaterial || !canEdit ? null : "")
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  // Only staff get the flag (the Student View drops it).
  const isPublished = material && "isPublished" in material ? material.isPublished : null

  const dirty = draft !== null && draft !== (material?.body ?? "")
  useUnsavedChangesGuard(dirty)

  async function save() {
    if (draft === null) return
    setSaving(true)
    const res = await fetch(`/api/courses/${courseSlug}/materials/${weekNo}/${kind}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: draft }),
    }).catch(() => null)
    const body = res ? await res.json().catch(() => ({})) : {}
    setSaving(false)
    if (res?.ok) {
      setMaterial(body.material)
      setDraft(null)
      setError(undefined)
      notify("success", "บันทึกเอกสารแล้ว")
    } else {
      setError(body.errors?.body)
      notify("error", body.error ?? "บันทึกไม่สำเร็จ")
    }
  }

  async function togglePublished() {
    if (isPublished === null) return
    setPublishing(true)
    const res = await fetch(`/api/courses/${courseSlug}/materials/${weekNo}/${kind}/publish`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !isPublished }),
    }).catch(() => null)
    const body = res ? await res.json().catch(() => ({})) : {}
    setPublishing(false)
    if (res?.ok) {
      setMaterial(body.material)
      notify("success", body.material.isPublished ? "เผยแพร่เอกสารแล้ว" : "เลิกเผยแพร่เอกสารแล้ว")
    } else {
      notify("error", body.error ?? "เปลี่ยนสถานะไม่สำเร็จ")
    }
  }

  return (
    <div className="print-controls flex flex-col gap-4">
      <Link
        href={`${coursePath}/materials`}
        className="inline-flex w-fit items-center gap-2 text-sm text-slate-500 hover:text-primary"
      >
        <FaArrowLeft className="h-3 w-3" />
        เอกสารการสอน
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">
            สัปดาห์ {weekNo} · {materialKindLabel(kind)}
          </p>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold text-primary">
            {heading ?? `สัปดาห์ ${weekNo}`}
            {isPublished === false && <UnpublishedBadge />}
          </h1>
          {staff && heading === null && (
            <p className="mt-1 text-sm text-amber-700">ไม่อยู่ในแผนการสอน — นักศึกษามองไม่เห็นเอกสารนี้</p>
          )}
        </div>
        {draft === null && canEdit && (
          <div className="flex gap-2">
            {isPublished !== null && (
              <button
                onClick={togglePublished}
                disabled={publishing}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                {isPublished ? <FaEyeSlash className="h-3.5 w-3.5" /> : <FaEye className="h-3.5 w-3.5" />}
                {isPublished ? "เลิกเผยแพร่" : "เผยแพร่"}
              </button>
            )}
            <button
              onClick={() => setDraft(material?.body ?? "")}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-white transition hover:bg-primary-hover"
            >
              <FaEdit className="h-3.5 w-3.5" />
              แก้ไข
            </button>
          </div>
        )}
        {draft !== null && (
          <div className="flex gap-2">
            {material ? (
              <button
                onClick={() => {
                  setDraft(null)
                  setError(undefined)
                }}
                disabled={saving}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
              >
                ยกเลิก
              </button>
            ) : (
              // Nothing to go back to yet — cancelling a new Material leaves the page.
              <Link
                href={`${coursePath}/materials`}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
              >
                ยกเลิก
              </Link>
            )}
            <button
              onClick={save}
              disabled={saving || (material !== null && !dirty)}
              className="rounded-lg bg-primary px-4 py-2 text-sm text-white transition hover:bg-primary-hover disabled:opacity-60"
            >
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        )}
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-5 print:rounded-none print:border-0 print:px-0">
        {draft !== null ? (
          <>
            <MarkdownField
              value={draft}
              onChange={setDraft}
              placeholder={"# หัวข้อ\n\nเนื้อหา… ใส่ลิงก์สไลด์ได้ เช่น [สไลด์](https://...)"}
            />
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
          </>
        ) : material?.body ? (
          <MarkdownContent content={material.body} />
        ) : (
          <p className="text-sm text-slate-400">ยังไม่มีเนื้อหา</p>
        )}
      </section>
    </div>
  )
}
