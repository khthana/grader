import { getCourseContext } from "@/lib/courses/server"
import { getCurrentUser } from "@/lib/session"
import { canMutateRoster } from "@/lib/courses/access"
import { PageTitle } from "@/components/shell/ComingSoon"
import { RosterTable } from "@/components/students/RosterTable"

export default async function StudentsPage() {
  const { activeCourse } = await getCourseContext()
  const user = await getCurrentUser()
  const canMutate = canMutateRoster(user?.roles ?? [])

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

      <RosterTable courseId={activeCourse.id} courseCode={activeCourse.code} canMutate={canMutate} />
    </div>
  )
}
