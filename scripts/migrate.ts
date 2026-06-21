// Run a migration SQL file against DATABASE_URL.
// Usage: DATABASE_URL=... npx tsx scripts/migrate.ts scripts/migrate-003-problem-reference-solution.sql
import { readFileSync } from "node:fs"
import { Pool } from "pg"

const file = process.argv[2]
if (!file) {
  console.error("Usage: npx tsx scripts/migrate.ts <sql-file>")
  process.exit(1)
}

const sql = readFileSync(file, "utf8")
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

pool.query(sql)
  .then(() => { console.log("✔ migration applied:", file); process.exit(0) })
  .catch((err: Error) => { console.error("✖", err.message); process.exit(1) })
  .finally(() => pool.end())
