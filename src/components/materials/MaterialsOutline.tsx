import Link from "next/link"
import { MATERIAL_KINDS, materialKindColumnLabel, type MaterialKind } from "@/lib/materials/kinds"
import type { MaterialsOutline as Outline, OutlineMaterial } from "@/lib/materials/outline"
import type { StudentOutlineMaterial } from "@/lib/materials/student-view"
import { MaterialCell } from "./MaterialCell"

type Shown = OutlineMaterial | StudentOutlineMaterial
type Row = { weekNo: number; heading: string | null; materials: Partial<Record<MaterialKind, Shown>> }

/**
 * Teaching Materials as one table (#120): a row per Teaching Plan week, headed
 * by its live topics, a column per Material Kind; each cell is a MaterialCell
 * (managers run it from there, #121). The outline comes already shaped for
 * the viewer (materialsOutlineFor). Staff also get the Unplanned rows last
 * (#111) — Students' outline has none.
 */
export function MaterialsOutline({
  outline,
  courseSlug,
  coursePath,
  canEdit,
  staff,
  hasPlan,
}: {
  outline: Outline<Shown>
  courseSlug: string
  coursePath: string
  canEdit: boolean
  staff: boolean
  hasPlan: boolean
}) {
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

  // Unplanned Materials, one row per week number (the outline sorts them by week).
  const unplannedRows: Row[] = []
  for (const m of outline.unplanned) {
    const last = unplannedRows.at(-1)
    if (last?.weekNo === m.weekNo) last.materials[m.kind] = m
    else unplannedRows.push({ weekNo: m.weekNo, heading: null, materials: { [m.kind]: m } })
  }

  const row = ({ weekNo, heading, materials }: Row, unplanned: boolean) => (
    <tr
      key={`${unplanned ? "u" : "w"}${weekNo}`}
      className={`border-t align-top ${unplanned ? "border-amber-200 bg-amber-50/60" : "border-gray-100"}`}
    >
      <td className={`px-4 py-3 text-center font-medium ${unplanned ? "text-amber-800" : "text-primary"}`}>{weekNo}</td>
      <td className={`px-4 py-3 ${unplanned ? "text-amber-800" : "text-slate-700"}`}>{heading ?? "ไม่อยู่ในแผนการสอน"}</td>
      {MATERIAL_KINDS.map((kind) => (
        <td key={kind} className="px-4 py-3">
          <MaterialCell
            courseSlug={courseSlug}
            coursePath={coursePath}
            weekNo={weekNo}
            kind={kind}
            material={materials[kind]}
            canEdit={canEdit}
            planned={!unplanned}
          />
        </td>
      ))}
    </tr>
  )

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
              <th className="w-20 px-4 py-2.5 text-center">สัปดาห์</th>
              <th className="px-4 py-2.5">หัวข้อ</th>
              {MATERIAL_KINDS.map((kind) => (
                <th key={kind} className="w-[22%] px-4 py-2.5">
                  {materialKindColumnLabel(kind)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {outline.weeks.map((week) => row(week, false))}
            {unplannedRows.map((week) => row(week, true))}
          </tbody>
        </table>
      </div>
      {unplannedRows.length > 0 && (
        <p className="text-xs text-amber-700">
          แถวสีเหลือง: สัปดาห์ของเอกสารเหล่านี้ไม่อยู่ในแผนการสอนแล้ว นักศึกษามองไม่เห็น — ย้ายไปสัปดาห์อื่นหรือลบได้
        </p>
      )}
    </div>
  )
}
