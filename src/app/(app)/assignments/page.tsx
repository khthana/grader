import { redirect } from "next/navigation"
import { getCourseContext } from "@/lib/courses/server"
import { buildCoursePath } from "@/lib/courses/slug"

export default async function AssignmentsPage() {
  const { activeCourse } = await getCourseContext()
  if (!activeCourse) {
    return (
      <div className="flex flex-col gap-6 font-thai">
        <h1 className="text-2xl font-semibold text-primary">งานที่ได้รับมอบหมาย</h1>
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center text-sm text-slate-400">
          กรุณาเลือกรายวิชาก่อน
        </div>
      </div>
    )
  }
  redirect(`${buildCoursePath(activeCourse)}/assignments`)
}
