import { redirect } from "next/navigation"
import { getCourseContext } from "@/lib/courses/server"
import { buildCoursePath } from "@/lib/courses/slug"
import { PageTitle } from "@/components/shell/ComingSoon"

export default async function StudentsPage() {
  const { activeCourse } = await getCourseContext()
  if (!activeCourse) {
    return (
      <div className="font-thai">
        <PageTitle icon="students">รายชื่อนักศึกษา</PageTitle>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-white py-20 text-center">
          <p className="text-lg font-medium text-slate-500">ยังไม่มีรายวิชา</p>
          <p className="text-sm text-slate-400">
            คุณยังไม่ได้รับมอบหมายให้ดูแลรายวิชาใด ๆ — สร้างรายวิชาที่หน้า "รายวิชา"
            หรือติดต่อผู้ดูแลระบบ
          </p>
        </div>
      </div>
    )
  }
  redirect(`${buildCoursePath(activeCourse)}/students`)
}
