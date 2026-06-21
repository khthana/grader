# Handoff — CE-Grader (Current State)

Date: 2026-06-21  
Project: `C:\Users\Terry\Desktop\Code\grader`  
Repo: https://github.com/khthana/grader.git  
Branch: `main`

---

## Status: Feature-complete ✅

All planned features shipped. 392 tests / 59 files — all pass.

---

## Features Shipped (chronological)

| Feature | Key commits |
|---|---|
| Auth + shell (login, Google OAuth, roles, navbar) | early history |
| User Management + Activity Logs + Impersonation | early history |
| Course management + Roster | early history |
| Problems CRUD + student view + grading (Piston) | early history |
| Review workbench + Gradebook + Assignments | early history |
| Scorebook | early history |
| Natural key migration (courses composite PK) | `migrate-001` |
| Week Release Toggle | `da24d7d`–`c22b9c5` + `migrate-002` |
| Reference Solution + Verify (Piston runner) | `ab7bf5b`, `c8257f4` + `migrate-003` |
| LLM module + generate endpoint | `6a92bff` |
| "สร้างด้วย AI" button in ProblemEditor | `b7799de` |
| User Profile page (nickname, avatar, password change) | `2ccd753`–`7fdc520` + `migrate-004` |

---

## Database Migrations Required

Apply in order on any existing DB. Use `npx tsx scripts/migrate.ts <file>` if `psql` is unavailable:

```sh
# Windows / Git-Bash — load .env.local then run each migration
set -a; . ./.env.local; set +a
npx tsx scripts/migrate.ts scripts/migrate-001-natural-keys.sql
npx tsx scripts/migrate.ts scripts/migrate-002-week-is-released.sql
npx tsx scripts/migrate.ts scripts/migrate-003-problem-reference-solution.sql
npx tsx scripts/migrate.ts scripts/migrate-004-user-nickname.sql
```

Fresh installs (`npm run db:setup`) get all columns via `schema.sql` automatically, but the seed step will error on an existing DB — safe to ignore.

**Post-migration note:** After applying migrate-002, all existing Weeks default to `is_released = false`. Instructors must manually release Weeks before students can see them.

---

## Environment Variables

Required in `.env.local`:

```
DATABASE_URL=postgresql://grader:grader@localhost:5433/grader
SESSION_SECRET=<long random string>
GOOGLE_CLIENT_ID=         # optional
GOOGLE_CLIENT_SECRET=     # optional
NEXTAUTH_URL=http://localhost:3000
```

Optional for AI generation:
```
ANTHROPIC_API_KEY=        # or LLM_API_KEY
LLM_MODEL=                # default: claude-haiku-4-5-20251001
```

---

## Key Architecture Notes

- **No psql needed for migrations** — use `npx tsx scripts/migrate.ts <sql-file>`
- **Reference solution security** — `getReferenceSolution(db, problemId)` is the only reader; never add `reference_solution` to `PROBLEM_COLS` / `ProblemRecord` / `ProblemDetail`
- **AI generate endpoint** — accepts `{ problemId }` (edit mode) OR `{ title, description, inputSpec?, outputSpec? }` (create mode); returns 503 when no LLM key
- **Test seam** — `setTestDb(pool)` injects pg-mem; route tests call handlers directly with `NextRequest`
- **`courseFixture()`** — baseline for any test needing a course: freshDb + Instructor + TA + Course C01/2567/1 + seedWeeks

---

## No Known Blockers

No open issues. No in-progress features. Next session can start fresh with new requirements.


