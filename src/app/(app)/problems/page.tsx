import { getCourseContext } from "@/lib/courses/server"
import { getCurrentUser } from "@/lib/session"
import { canManageCourses } from "@/lib/courses/access"
import { PageTitle } from "@/components/shell/ComingSoon"
import { ProblemsTable } from "@/components/problems/ProblemsTable"

export default async function ProblemsPage() {
  const { activeCourse } = await getCourseContext()
  const user = await getCurrentUser()
  const canManage = canManageCourses(user?.roles ?? [])

  if (!activeCourse) {
    return (
      <div className="font-thai">
        <PageTitle icon="problems">โจทย์ปัญหา</PageTitle>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-white py-20 text-center">
          <p className="text-lg font-medium text-slate-500">ยังไม่มีรายวิชา</p>
          <p className="text-sm text-slate-400">
            เลือกรายวิชาจาก switcher ด้านบน หรือสร้างรายวิชาใหม่ที่หน้า "รายวิชา"
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="font-thai">
      <div className="mb-1 flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-primary">โจทย์ปัญหา</h1>
      </div>
      <p className="mb-6 text-sm text-slate-500">
        {activeCourse.code} · {activeCourse.nameTh}
      </p>

      <ProblemsTable courseId={activeCourse.id} canManage={canManage} />
    </div>
  )
}
