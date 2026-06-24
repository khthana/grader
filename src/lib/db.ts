import { Pool } from "pg"

export interface Queryable {
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: T[] }>
}

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

interface PoolLike {
  connect: () => Promise<Queryable & { release: () => void }>
}

// Run `fn` inside a single DB transaction. Checks out one connection so BEGIN /
// COMMIT / ROLLBACK apply to the same client (a pooled `query` could otherwise
// span connections). Both pg and the pg-mem adapter expose `connect()`.
export async function withTransaction<T>(
  fn: (tx: Queryable) => Promise<T>
): Promise<T> {
  const pool = getDb() as unknown as PoolLike
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const result = await fn(client)
    await client.query("COMMIT")
    return result
  } catch (err) {
    await client.query("ROLLBACK")
    throw err
  } finally {
    client.release()
  }
}
