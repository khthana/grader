import { redirect, notFound } from "next/navigation"
import { getCourseAccess, getCourseContext } from "@/lib/courses/server"
import { resolveLegacyRedirect } from "@/lib/courses/legacy-redirect"

export default async function ReviewPage() {
  const { activeCourse } = await getCourseContext()
  const access = activeCourse ? await getCourseAccess(activeCourse) : null
  const next = resolveLegacyRedirect(activeCourse, access, { section: "review", requires: "manager" })
  if (next.kind === "not-found") notFound()
  if (next.kind === "redirect") redirect(next.path)

  return (
    <div className="flex flex-col gap-6 font-thai">
      <h1 className="text-2xl font-semibold text-primary">ตรวจงาน</h1>
      <div className="rounded-xl border border-gray-200 bg-white py-16 text-center text-sm text-slate-400">
        กรุณาเลือกรายวิชาก่อน
      </div>
    </div>
  )
}
