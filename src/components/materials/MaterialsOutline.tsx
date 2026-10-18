import Link from "next/link"
import { FaPlus } from "react-icons/fa"
import { MATERIAL_KINDS, materialKindLabel, type MaterialKind } from "@/lib/materials/kinds"
import type { MaterialsOutline as Outline, MaterialSummary } from "@/lib/materials/outline"
import type { StudentMaterialSummary } from "@/lib/materials/student-view"

type Summary = MaterialSummary | StudentMaterialSummary

/**
 * Teaching Materials by Teaching Plan week (#109): one card per plan week,
 * headed by its live topics, with a slot per Material Kind. The outline comes
 * already shaped for the viewer (materialsOutlineFor); this only decides which
 * empty slots to draw (staff see them, managers can create in them). Staff
 * also get the Unplanned group last (#111) — Students' outline has none.
 */
export function MaterialsOutline({
  outline,
  coursePath,
  canEdit,
  staff,
  hasPlan,
}: {
  outline: Outline<Summary>
  coursePath: string
  canEdit: boolean
  staff: boolean
  hasPlan: boolean
}) {
  const href = (weekNo: number, kind: MaterialKind) => `${coursePath}/materials/${weekNo}/${kind}`

  if (outline.weeks.length === 0 && outline.unplanned.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white py-16 text-center text-sm text-slate-400">
        {staff && !hasPlan ? (
          <>
            ยังไม่มีแผนการสอน —{" "}
            <Link href={`${coursePath}/syllabus`} className="text-secondary hover:underline">
              เพิ่มแผนการสอนในประมวลรายวิชา
            </Link>
          </>
        ) : (
          "ยังไม่มีเอกสารการสอน"
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {outline.weeks.map((week) => (
        <section key={week.weekNo} className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 font-medium text-primary">
            สัปดาห์ {week.weekNo} · {week.heading}
          </h2>
          <div className="grid gap-2 sm:grid-cols-3">
            {MATERIAL_KINDS.map((kind) => {
              const material = week.materials[kind]
              if (material) {
                return (
                  <Link
                    key={kind}
                    href={href(week.weekNo, kind)}
                    className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-4 py-3 text-sm text-slate-700 transition hover:border-secondary hover:bg-slate-50"
                  >
                    {materialKindLabel(kind)}
                    {"isPublished" in material && !material.isPublished && <UnpublishedBadge />}
                  </Link>
                )
              }
              if (!staff) return null
              return canEdit ? (
                <Link
                  key={kind}
                  href={href(week.weekNo, kind)}
                  className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm text-slate-400 transition hover:border-secondary hover:text-secondary"
                >
                  <FaPlus className="h-3 w-3" />
                  สร้าง{materialKindLabel(kind)}
                </Link>
              ) : (
                <div key={kind} className="rounded-lg border border-dashed border-gray-200 px-4 py-3 text-sm text-slate-300">
                  {materialKindLabel(kind)} —
                </div>
              )
            })}
          </div>
        </section>
      ))}
      {outline.unplanned.length > 0 && (
        <section className="rounded-xl border border-dashed border-amber-300 bg-amber-50/40 p-5">
          <h2 className="font-medium text-amber-800">ไม่อยู่ในแผนการสอน</h2>
          <p className="mb-3 text-xs text-amber-700">
            สัปดาห์ของเอกสารเหล่านี้ไม่อยู่ในแผนการสอนแล้ว นักศึกษามองไม่เห็น — ย้ายไปสัปดาห์อื่นหรือลบได้
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {outline.unplanned.map((material) => (
              <Link
                key={`${material.weekNo}/${material.kind}`}
                href={href(material.weekNo, material.kind)}
                className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-slate-700 transition hover:border-secondary hover:bg-slate-50"
              >
                สัปดาห์ {material.weekNo} · {materialKindLabel(material.kind)}
                {"isPublished" in material && !material.isPublished && <UnpublishedBadge />}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export function UnpublishedBadge() {
  return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700 print:hidden">ยังไม่เผยแพร่</span>
}
