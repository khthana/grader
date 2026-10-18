// Sweeping unreferenced Attachment bytes (#115, ADR 0013): the database is the
// only source of truth, so every delete path only deletes rows, and this one
// rule removes whatever files no row points to any more.

import type { Queryable } from "@/lib/db"
import { listReferencedHashes } from "./repository"
import { sweepFiles } from "./store"

/** A file younger than this is never swept — its upload may not have written its row yet. */
export const SWEEP_GRACE_MS = 60 * 60 * 1000

/** Remove every stored file no Attachment refers to; returns how many went. */
export async function sweepAttachments(db: Queryable): Promise<number> {
  const referenced = new Set(await listReferencedHashes(db))
  return sweepFiles(referenced, new Date(Date.now() - SWEEP_GRACE_MS))
}

/** After a request that dropped rows: sweep, but never fail the request over it. */
export async function sweepAttachmentsQuietly(db: Queryable): Promise<void> {
  try {
    await sweepAttachments(db)
  } catch (err) {
    console.error("attachment sweep failed", err)
  }
}
