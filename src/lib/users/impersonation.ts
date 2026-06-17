// Pure gate for Admin impersonation (dev-only). Decides whether an actor may
// impersonate a target, independent of the database/HTTP. The "target exists"
// check requires the DB and stays in the route handler.

export interface ImpersonateInput {
  actorRoles: string[]
  actorId: number
  targetId: number
  isProduction: boolean
}

export type ImpersonateCheck =
  | { ok: true }
  | { ok: false; reason: "production" | "not-admin" | "self" }

export function canImpersonate(input: ImpersonateInput): ImpersonateCheck {
  // Disabled entirely outside development — no account-takeover surface in prod.
  if (input.isProduction) return { ok: false, reason: "production" }
  if (!input.actorRoles.includes("Admin")) return { ok: false, reason: "not-admin" }
  if (input.actorId === input.targetId) return { ok: false, reason: "self" }
  return { ok: true }
}
