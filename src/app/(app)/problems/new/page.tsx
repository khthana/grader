import { redirect } from "next/navigation"
import { getCourseContext } from "@/lib/courses/server"
import { buildCoursePath } from "@/lib/courses/slug"

interface PageProps {
  searchParams: Promise<{ weekId?: string }>
}

export default async function LegacyNewProblemPage({ searchParams }: PageProps) {
  const { activeCourse } = await getCourseContext()
  if (!activeCourse) redirect("/courses")

  const { weekId } = await searchParams
  const query = weekId ? `?weekId=${weekId}` : ""
  redirect(`${buildCoursePath(activeCourse)}/problems/new${query}`)
}
