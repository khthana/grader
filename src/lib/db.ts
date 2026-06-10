import { Pool } from "pg"
import type { Queryable } from "./users/repository"

// Lazy singleton pool. Tests inject a pg-mem adapter via setTestDb().
let db: Queryable | null = null

export function getDb(): Queryable {
  if (db) return db
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set")
  }
  db = new Pool({ connectionString }) as unknown as Queryable
  return db
}

// Test seam — not for production use.
export function setTestDb(testDb: Queryable | null): void {
  db = testDb
}
