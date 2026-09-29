import { notFound, redirect } from "next/navigation"
import { getDb } from "@/lib/db"
import { SESSION_ENDED_PATH } from "@/lib/auth"
import { getCurrentUser } from "@/lib/session"
import { resolveLegacyProblemPath } from "@/lib/problems/legacy-path"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function LegacySubmissionsPage({ params }: PageProps) {
  const { id } = await params
  const problemId = Number.parseInt(id, 10)
  if (!Number.isFinite(problemId)) notFound()

  const user = await getCurrentUser()
  if (!user) redirect(SESSION_ENDED_PATH)

  // Gated like the target page, or the redirect itself leaks where the problem lives (#80).
  const path = await resolveLegacyProblemPath(getDb(), user, problemId, "/submissions")
  if (!path) notFound()
  redirect(path)
}
