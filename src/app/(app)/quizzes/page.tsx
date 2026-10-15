import { redirect, notFound } from "next/navigation"
import { getCourseAccess, getCourseContext } from "@/lib/courses/server"
import { resolveLegacyRedirect } from "@/lib/courses/legacy-redirect"

// Staff and Students alike — each sees their own quiz list (#92).
export default async function QuizzesPage() {
  const { activeCourse } = await getCourseContext()
  const access = activeCourse ? await getCourseAccess(activeCourse) : null
  const next = resolveLegacyRedirect(activeCourse, access, { section: "quizzes", requires: "linked" })
  if (next.kind === "not-found") notFound()
  if (next.kind === "redirect") redirect(next.path)

  return (
    <div className="flex flex-col gap-6 font-thai">
      <h1 className="text-2xl font-semibold text-primary">แบบทดสอบ</h1>
      <div className="rounded-xl border border-gray-200 bg-white py-16 text-center text-sm text-slate-400">
        กรุณาเลือกรายวิชาก่อน
      </div>
    </div>
  )
}
