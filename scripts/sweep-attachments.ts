// Sweep Teaching Material Attachment files no row refers to (#115, ADR 0013).
// Requests already sweep after a replace or delete; run this after a restore,
// or to catch anything a failed sweep left behind.
// Usage: npx tsx scripts/sweep-attachments.ts   (uses DATABASE_URL + ATTACHMENTS_DIR)
import { readFileSync } from "node:fs"
import { Pool } from "pg"
import { sweepAttachments } from "../src/lib/materials/attachments/sweep"
import { storeRoot } from "../src/lib/materials/attachments/store"

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

// The store this database's rows describe — sweeping another one would delete files it never knew.
console.log(`sweeping ${storeRoot()}`)

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

sweepAttachments(pool)
  .then((removed) => { console.log(`✔ swept ${removed} unreferenced attachment file(s)`); process.exit(0) })
  .catch((err: Error) => { console.error("✖", err.message); process.exit(1) })
  .finally(() => pool.end())
