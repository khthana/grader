import { verifySessionToken } from "./auth"
import { getDb } from "./db"
import { findUserByEmail, getUserWithRoles, type UserWithRoles } from "./users/repository"

// The one place a session cookie becomes a user — shared by route handlers
// (getUserFromRequest) and server components (getCurrentUser). A signed token
// is not enough on its own: the account must still exist and be active, so an
// Admin deactivating a user ends their open 8h sessions immediately (#75).
export async function resolveSessionUser(
  token: string | undefined
): Promise<UserWithRoles | null> {
  const session = token ? verifySessionToken(token) : null
  if (!session) return null

  const db = getDb()
  const user = await findUserByEmail(db, session.email)
  if (!user?.isActive) return null
  return getUserWithRoles(db, user.id)
}
