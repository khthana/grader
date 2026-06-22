// Run a migration SQL file against DATABASE_URL.
// Usage: npx tsx scripts/migrate.ts scripts/migrate-00N-*.sql
import { readFileSync } from "node:fs"
import { Pool } from "pg"

// Load .env.local if DATABASE_URL not already in environment
if (!process.env.DATABASE_URL) {
  try {
    const env = readFileSync(".env.local", "utf8")
    for (const line of env.split("\n")) {
      const match = line.match(/^([^#=]+)=(.*)$/)
      if (match) process.env[match[1].trim()] = match[2].trim()
    }
  } catch { /* .env.local not found — rely on DATABASE_URL being set externally */ }
}

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
