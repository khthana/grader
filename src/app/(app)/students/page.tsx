import { getCourseContext } from "@/lib/courses/server"
import { PageTitle } from "@/components/shell/ComingSoon"

const COLUMNS = [
  "#",
  "รหัสนักศึกษา",
  "คำนำหน้า",
  "ชื่อ - นามสกุล",
  "หลักสูตร",
  "กลุ่ม",
  "ปีการศึกษา",
]

export default async function StudentsPage() {
  const { activeCourse } = await getCourseContext()

  if (!activeCourse) {
    return (
      <div className="font-thai">
        <PageTitle icon="students">รายชื่อนักศึกษา</PageTitle>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-white py-20 text-center">
          <p className="text-lg font-medium text-slate-500">ยังไม่มีรายวิชา</p>
          <p className="text-sm text-slate-400">
            คุณยังไม่ได้รับมอบหมายให้ดูแลรายวิชาใด ๆ — สร้างรายวิชาที่หน้า “รายวิชา”
            หรือติดต่อผู้ดูแลระบบ
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="font-thai">
      <div className="mb-1 flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-primary">รายชื่อนักศึกษา</h1>
      </div>
      <p className="mb-6 text-sm text-slate-500">
        {activeCourse.code} · {activeCourse.nameTh}
      </p>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-slate-100 text-slate-600">
            <tr>
              {COLUMNS.map((col) => (
                <th key={col} className="px-4 py-3 text-left font-medium">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={COLUMNS.length} className="px-4 py-16 text-center text-slate-400">
                ยังไม่มีนักศึกษาในรายวิชานี้
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
