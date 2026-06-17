// Applies schema.sql and seeds an initial Admin. Idempotent.
// Usage: DATABASE_URL=... npm run db:setup
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { Pool } from "pg"
import { hashPassword } from "../src/lib/password"
import { createUser, findUserByEmail, assignRole } from "../src/lib/users/repository"
import { createCourse, assignInstructor } from "../src/lib/courses/repository"
import { seedWeeks, DEFAULT_WEEKS } from "../src/lib/weeks/repository"

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@kmitl.ac.th"
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Password123!"
const ADMIN_NAME = process.env.SEED_ADMIN_NAME ?? "System Admin"

const SEED_COURSE = {
  code: "01076021",
  nameTh: "โครงสร้างข้อมูลและอัลกอริทึม",
  nameEn: "Data Structures and Algorithms",
  program: "วิศวกรรมคอมพิวเตอร์",
}

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

    let admin = await findUserByEmail(pool, ADMIN_EMAIL)
    if (admin) {
      console.log(`• admin already exists: ${ADMIN_EMAIL}`)
    } else {
      admin = await createUser(pool, {
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

    // Seed one course and assign the admin to it (idempotent by course code).
    const { rows } = await pool.query<{ id: number }>(
      `SELECT id FROM courses WHERE code = $1`,
      [SEED_COURSE.code]
    )
    let courseId = rows[0]?.id
    if (courseId) {
      console.log(`• course already exists: ${SEED_COURSE.code}`)
    } else {
      const course = await createCourse(pool, SEED_COURSE)
      courseId = course.id
      console.log(`✔ seeded course: ${SEED_COURSE.code}`)
    }
    await assignInstructor(pool, courseId, admin.id)
    await seedWeeks(pool, courseId)
    console.log(`✔ seeded ${DEFAULT_WEEKS} weeks for course ${SEED_COURSE.code}`)
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
