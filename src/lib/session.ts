import { cookies } from "next/headers"
import { verifySessionToken } from "./auth"
import { getDb } from "./db"
import { findUserByEmail, getUserWithRoles, type UserWithRoles } from "./users/repository"

// Server-side: resolve the signed-in user (with roles) from the session cookie.
export async function getCurrentUser(): Promise<UserWithRoles | null> {
  const token = (await cookies()).get("session")?.value
  const session = token ? verifySessionToken(token) : null
  if (!session) return null

  const db = getDb()
  const user = await findUserByEmail(db, session.email)
  if (!user) return null
  return getUserWithRoles(db, user.id)
}

export async function getActiveRoleCookie(): Promise<string | undefined> {
  return (await cookies()).get("active_role")?.value
}
