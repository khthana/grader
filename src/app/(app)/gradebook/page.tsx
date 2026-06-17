import { notFound } from "next/navigation"
import { getCurrentUser } from "@/lib/session"
import { getCourseContext } from "@/lib/courses/server"
import { isTeachingStaff } from "@/lib/courses/access"
import { GradebookTable } from "@/components/gradebook/GradebookTable"

export default async function GradebookPage() {
  const [user, { activeCourse }] = await Promise.all([getCurrentUser(), getCourseContext()])

  if (!user || !isTeachingStaff(user.roles)) notFound()
  if (!activeCourse) {
    return (
      <div className="flex flex-col gap-6 font-thai">
        <h1 className="text-2xl font-semibold text-primary">สมุดคะแนน</h1>
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center text-sm text-slate-400">
          กรุณาเลือกรายวิชาก่อน
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 font-thai">
      <div>
        <h1 className="text-2xl font-semibold text-primary">สมุดคะแนน</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          {activeCourse.nameTh} ({activeCourse.code})
        </p>
      </div>
      <GradebookTable courseId={activeCourse.id} courseCode={activeCourse.code} />
    </div>
  )
}
