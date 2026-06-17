import { getCourseContext } from "@/lib/courses/server"
import { AssignmentsList } from "@/components/assignments/AssignmentsList"

export default async function AssignmentsPage() {
  const { activeCourse } = await getCourseContext()

  if (!activeCourse) {
    return (
      <div className="flex flex-col gap-6 font-thai">
        <h1 className="text-2xl font-semibold text-primary">งานที่ได้มอบหมาย</h1>
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center text-sm text-slate-400">
          กรุณาเลือกรายวิชาก่อน
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 font-thai">
      <div>
        <h1 className="text-2xl font-semibold text-primary">งานที่ได้มอบหมาย</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          {activeCourse.nameTh} ({activeCourse.code})
        </p>
      </div>
      <AssignmentsList courseId={activeCourse.id} />
    </div>
  )
}
