# CE-Grader

ระบบตรวจและให้คะแนน Python code ของนักศึกษาอัตโนมัติ (Computer Engineering Python Grader)  
Faculty of Engineering, KMITL — Standalone product (the sibling `DEEP-QA-*` repos are read-only design references).

นักศึกษาส่ง Python code เข้ามา ระบบรันกับ test cases ผ่าน [Piston](https://github.com/engineer-man/piston) แล้วให้คะแนนพร้อม feedback ทันที

## Features

| ฟีเจอร์ | รายละเอียด |
|---------|-----------|
| **Auth** | Postgres-backed login (email/password + Google OAuth), HMAC-signed session cookie, 8h expiry |
| **Roles** | Admin · Instructor · TA · Student — many-to-many, role switcher ใน navbar |
| **User Management** | CRUD + bulk xlsx import + role assignment (Admin only) |
| **Activity Logs** | บันทึกทุก action สำคัญ (Admin only) |
| **Dev Impersonation** | Admin เข้าดู session ของ user อื่นได้ (dev only) |
| **Course Management** | CRUD รายวิชา + มอบหมาย Instructor/TA (Admin/Instructor) |
| **Student Roster** | CRUD + bulk xlsx import/export + กรองกลุ่ม (Instructor/TA) |
| **Problems** | สร้าง/แก้ไขโจทย์พร้อม test cases, คำอธิบาย **Markdown**, กำหนดเวลา due/close |
| **Grading** | `mode:run` รัน visible tests; `mode:submit` รัน all tests + เก็บ Submission + ตรวจ deadline |
| **Review Workbench** | 3-column grading UI — problem switcher + code viewer + score panel; bonus stepper; URL state `?pid=&sid=` (Instructor/Admin) |
| **Gradebook** | matrix student × problem (effective score = `COALESCE(manual_score, points_earned)`) (Instructor/Admin) |
| **Assignments** | นักศึกษาดูรายการโจทย์ต่อสัปดาห์พร้อม 4-state badge และคะแนนของตัวเอง |
| **Scorebook** | นักศึกษาดูคะแนนสรุปของตัวเองต่อสัปดาห์ — donut SVG banner + ตารางคะแนน (Student only) |
| **Week Release** | Instructor/Admin ปล่อย/ซ่อนโจทย์ราย Week ด้วย lock icon; Student เห็นเฉพาะ Week ที่ปล่อยแล้ว |
| **Reference Solution** | เก็บเฉลย Python ต่อโจทย์ + ปุ่ม "รันเฉลย" verify expected outputs ผ่าน Piston (ไม่เผยให้ Student) |
| **AI Test-Case Generation** | ปุ่ม "สร้างด้วย AI" เขียนเฉลย + test inputs (io) หรือ unit test block (unit) ผ่าน LLM |
| **Code Policy** | Blacklist / Whitelist ต่อโจทย์ — ตรวจ whole-word ก่อนรัน ปฏิเสธโค้ดที่ละเมิด |
| **Unit Test Mode** | โจทย์แบบ pytest-style block (`assert`) — all-or-nothing scoring; แสดง traceback เมื่อ fail |
| **User Profile** | ตั้ง nickname + อัปโหลด avatar (resize 256×256) + เปลี่ยนรหัสผ่าน (ทุก role) |
| **Course Duplication** | ทำซ้ำทั้งวิชา (โจทย์ + เฉลย + test cases + ผู้สอน + weeks) ไปภาคการศึกษาใหม่คลิกเดียว (Instructor/Admin) |

## Tech stack

- **Next.js 16** (App Router, Turbopack) · TypeScript · React 19
- **Tailwind CSS v4** + `@tailwindcss/typography` · `react-icons`
- **PostgreSQL** via raw `pg` + SQL · **bcryptjs** password hashing
- **Piston** — sandboxed code execution (Python 3.10.0)
- HMAC-SHA256 session cookie · Google OAuth (optional) · route protection via Next 16 `proxy`
- **Vitest** + **pg-mem** (in-memory Postgres) for tests · `xlsx` for bulk import/export
- `react-markdown` + `remark-gfm` — Markdown rendering for problem descriptions
- **Docker Compose** — full stack (db + piston + app) in one command ([ADR 0008](docs/adr/0008-dockerize-full-stack.md))

> No MUI · No framer-motion · No react-router

## Two ways to run

| | Run with Docker (full stack) | Run on the host (dev) |
|---|---|---|
| **Needs** | Docker only | Node 20+ · a reachable PostgreSQL · a Piston engine |
| **Env file** | `.env` (read by Compose) | `.env.local` (read by Next.js) |
| **Brings up** | db + piston + python + migrate + app, one command | app only — you provide db/piston |
| **Best for** | first run, demo, "just make it work" | fast iteration with HMR |

> **The two env files are not interchangeable.** Docker Compose reads **`.env`**;
> `npm run dev` reads **`.env.local`**. A value set only in `.env.local` is invisible to
> Compose (and vice-versa). In the Docker path, `DATABASE_URL`/`PISTON_URL` are set to the
> service names inside `docker-compose.yml`, so they do **not** belong in `.env`. Both files
> are gitignored. See [ADR 0008](docs/adr/0008-dockerize-full-stack.md).

## Run with Docker (full stack) — recommended

**1. Create `.env`** (Compose reads this; `SESSION_SECRET` is required):
```
SESSION_SECRET=<long-random-string>
NEXTAUTH_URL=http://localhost:3000
# optional — Google login degrades gracefully if omitted
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
# optional — AI test-case generation
ANTHROPIC_API_KEY=
# optional — host port override (default 3000); see WinNAT note below
# APP_PORT=3100
```

**2. Bring up the stack**
```bash
docker compose up -d --build
```
This builds the app image, pulls Postgres + Piston, installs **Python 3.10.0** into
Piston (`piston-init`), and applies `schema.sql` + seeds the Admin (`migrate`). The
`migrate` and `piston-init` services are one-shot — they run, exit 0, and show as
`Exited (0)` in `docker compose ps -a`; that is normal.

Open **http://localhost:3000** → Admin **admin@kmitl.ac.th** / **Password123!**

Everyday commands: `docker compose up -d` · `docker compose down` ·
`docker compose logs -f app` · `docker compose up -d --build app` (rebuild after code
changes).

> **Windows port 3000 fails to bind?** If `docker compose up` errors with
> `bind: An attempt was made to access a socket in a way forbidden by its access permissions`,
> WinNAT/Hyper-V has reserved the range containing 3000 (seen: 2928–3027). Either free it —
> `net stop winnat && net start winnat` in an elevated PowerShell — or set `APP_PORT=3100`
> in `.env` **and** match `NEXTAUTH_URL=http://localhost:3100`. Check reserved ranges with
> `netsh interface ipv4 show excludedportrange protocol=tcp`.

## Run on the host (dev)

**1. Install dependencies**
```bash
npm install
```

**2. Create `.env.local`**
```
DATABASE_URL=postgresql://user:pass@host:5432/db
SESSION_SECRET=<long-random-string>
NEXTAUTH_URL=http://localhost:3000
# optional — Google login degrades gracefully if omitted
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

**3. (Optional) spin up just Postgres with Docker**
```bash
docker run -d --name grader-db --restart unless-stopped \
  -e POSTGRES_USER=grader -e POSTGRES_PASSWORD=grader -e POSTGRES_DB=grader \
  -p 5433:5432 -v grader-db-data:/var/lib/postgresql/data postgres:16-alpine
# DATABASE_URL=postgresql://grader:grader@localhost:5433/grader
```
You still need a Piston engine reachable via `PISTON_URL` for grading to work.

**4. Create tables and seed the initial Admin**
```bash
# On Windows (Git Bash):
set -a; . ./.env.local; set +a; npm run db:setup
```
Default Admin: **admin@kmitl.ac.th** / **Password123!**

**5. Run the dev server**
```bash
npm run dev
```
เปิด http://localhost:3000 (redirect ไป `/login` อัตโนมัติ)

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm test` | Run the Vitest suite (462 tests) |
| `npm run test:watch` | Vitest watch mode |
| `npm run db:setup` | Apply `schema.sql` + seed Admin (needs `DATABASE_URL`) |

## Database migration

**Fresh install:** `npm run db:setup` ครอบคลุมทุกอย่าง

**Existing dev DB** (อัปเกรดจาก schema เก่า): apply migration scripts ตามลำดับ — ใช้ `npx tsx scripts/migrate.ts <file>` เมื่อไม่มี `psql` (โหลด `.env.local` ให้อัตโนมัติ):
```bash
npx tsx scripts/migrate.ts scripts/migrate-001-natural-keys.sql             # surrogate id → natural PK (code, year, semester)
npx tsx scripts/migrate.ts scripts/migrate-002-week-is-released.sql         # weeks.is_released
npx tsx scripts/migrate.ts scripts/migrate-003-problem-reference-solution.sql
npx tsx scripts/migrate.ts scripts/migrate-004-user-nickname.sql
npx tsx scripts/migrate.ts scripts/migrate-005-unit-test-blacklist.sql      # problem_type/function_name/starter_code/blacklist/whitelist + test_cases.score
npx tsx scripts/migrate.ts scripts/migrate-006-unit-test-code.sql           # problems.unit_test_code
```
ทุก script รันซ้ำได้ปลอดภัย (idempotent). **Course Duplication ไม่ต้อง migrate** — reuse ตารางเดิม

## Database backup & restore

`schema.sql` สร้างแค่ตาราง ไม่มีข้อมูล ถ้าต้องการย้ายข้อมูลระหว่างเครื่อง dump/restore Postgres โดยตรง
เก็บไฟล์ dump ไว้ใน `local/` (gitignored — dump มีอีเมล + bcrypt hash ของผู้ใช้จริง ห้ามขึ้น git):

**Docker stack** — Postgres คือ service `db` (container `grader-db-1`):
```bash
# Backup — --clean --if-exists ให้ restore ทับ DB เดิมได้
docker compose exec -T db pg_dump -U grader --clean --if-exists grader > local/grader-backup.sql

# Restore — ล้าง schema ก่อนแล้วโหลด dump
# (อย่าใช้ db:setup + psql -f ตรง ๆ: DROP CONSTRAINT ใน --clean dump จะ error เพราะ FK
#  ordering — courses_pkey. ล้างทั้ง schema แล้วให้ CREATE ใน dump สร้างใหม่จะชัวร์กว่า)
docker compose exec -T db psql -U grader -d grader -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
docker compose exec -T db psql -U grader -d grader < local/grader-backup.sql
```
หมายเหตุ: service `migrate` seed Admin + วิชา `01076021` ทุกครั้งที่ `up` ฉะนั้นการ restore
ข้อมูลจริงคือการโหลดทับ seed (seed เป็น idempotent ไม่ลบ row ที่ restore เข้ามา)

**Host Postgres** (`DATABASE_URL` ตรง ๆ):
```bash
pg_dump "$DATABASE_URL" --clean --if-exists -f local/grader-backup.sql
psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
psql "$DATABASE_URL" -f local/grader-backup.sql
```

## Testing

Unit tests: pure modules (session, password, roles, breadcrumbs, validation, import)  
Integration tests: repositories + API route handlers ทดสอบกับ **pg-mem** — ไม่ต้องใช้ Docker

```bash
npm test   # 462 tests / 63 files
```

## Project layout

```
src/
  app/
    (app)/                          # authenticated shell (layout.tsx = navbar + sidebar)
      courses/
        page.tsx                    # course list (Admin/Instructor)
        [code]/[year]/[semester]/   # course-scoped pages
          layout.tsx                # slug validation + auth gate
          problems/                 # โจทย์ปัญหา
          students/                 # รายชื่อนักศึกษา
          gradebook/                # สมุดคะแนน (Instructor/Admin)
          review/                   # ตรวจงาน — grading workbench (Instructor/Admin)
          assignments/              # งานที่ได้รับมอบหมาย (Student)
          scorebook/                # สมุดคะแนนของฉัน (Student)
      users/                        # จัดการผู้ใช้ (Admin)
      logs/                         # บันทึกกิจกรรม (Admin)
      problems|students|gradebook|
      review|assignments|scorebook/ # thin redirectors → active course URL
    api/
      auth/                         # login · logout · me · google OAuth
      grade/                        # POST /api/grade — thin orchestrator over lib/grading
      courses/                      # GET/POST /api/courses
        [code]/[year]/[semester]/   # course-scoped API routes
  lib/
    courses/ enrollments/ problems/
    weeks/ submissions/ gradebook/
    assignments/ scorebook/ users/ logs/  # repositories + domain logic
    grading/                          # gradeSubmission() deep module + CodeRunner seam (ADR 0007)
    code-policy/ llm/                 # blacklist/whitelist check · AI test-plan generation
  components/
    shell/                          # Navbar · Sidebar · Breadcrumbs · AppShell
    problems/ students/ courses/
    scorebook/ users/ editor/ ui/   # feature components
  proxy.ts                          # Next 16 route protection (Node runtime)

schema.sql                          # database schema (source of truth)
scripts/
  migrate-001-natural-keys.sql      # one-time dev DB migration
  seed-lab1.ts setup-db.ts          # seed scripts (natural-key API)
docker-compose.yml Dockerfile       # full-stack containers (ADR 0008)
requirement/labs/                   # raw lab source material (not referenced by code)
local/                              # gitignored — DB dumps, notes, machine-local artifacts
```

## Architecture & conventions

ดูรายละเอียดได้ที่ [CLAUDE.md](CLAUDE.md) — ครอบคลุม routing, auth, data layer, testing patterns, และ conventions ทั้งหมด

- `docs/adr/` — architecture decision records
- `CONTEXT.md` — domain glossary
- `requirement/PRD.md` — ข้อกำหนดทุก feature รวมในไฟล์เดียว
