import { redirect, notFound } from "next/navigation"
import { getCurrentUser } from "@/lib/session"
import { getCourseContext } from "@/lib/courses/server"
import { canManageCourses } from "@/lib/courses/access"
import { buildCoursePath } from "@/lib/courses/slug"

export default async function ReviewPage() {
  const [user, { activeCourse }] = await Promise.all([getCurrentUser(), getCourseContext()])
  if (!user || !canManageCourses(user.roles)) notFound()
  if (!activeCourse) {
    return (
      <div className="flex flex-col gap-6 font-thai">
        <h1 className="text-2xl font-semibold text-primary">ตรวจงาน</h1>
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center text-sm text-slate-400">
          กรุณาเลือกรายวิชาก่อน
        </div>
      </div>
    )
  }
  redirect(`${buildCoursePath(activeCourse)}/review`)
}
