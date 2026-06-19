import { redirect } from "next/navigation"
import { getCourseContext } from "@/lib/courses/server"
import { buildCoursePath } from "@/lib/courses/slug"
import { PageTitle } from "@/components/shell/ComingSoon"

export default async function ProblemsPage() {
  const { activeCourse } = await getCourseContext()
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
  redirect(`${buildCoursePath(activeCourse)}/problems`)
}
