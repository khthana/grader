// Applies schema.sql and seeds an initial Admin. Idempotent.
// Usage: DATABASE_URL=... npm run db:setup
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { Pool } from "pg"
import { hashPassword } from "../src/lib/password"
import { createUser, findUserByEmail, assignRole } from "../src/lib/users/repository"

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@kmitl.ac.th"
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Password123!"
const ADMIN_NAME = process.env.SEED_ADMIN_NAME ?? "System Admin"

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set")
  }

  const pool = new Pool({ connectionString })
  try {
    const schema = readFileSync(
      fileURLToPath(new URL("../schema.sql", import.meta.url)),
      "utf8"
    )
    await pool.query(schema)
    console.log("✔ schema applied")

    const existing = await findUserByEmail(pool, ADMIN_EMAIL)
    if (existing) {
      console.log(`• admin already exists: ${ADMIN_EMAIL}`)
    } else {
      const admin = await createUser(pool, {
        email: ADMIN_EMAIL,
        name: ADMIN_NAME,
        passwordHash: await hashPassword(ADMIN_PASSWORD),
        firstNameTh: "ผู้ดูแล",
        lastNameTh: "ระบบ",
        idCode: "admin",
      })
      await assignRole(pool, admin.id, "Admin")
      console.log(`✔ seeded admin: ${ADMIN_EMAIL}`)
    }
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
