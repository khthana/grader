# Handoff — Week Release Toggle (COMPLETE)

Date: 2026-06-21  
Project: `C:\Users\Terry\Desktop\Code\grader` (CE-Grader)  
Repo: https://github.com/khthana/grader.git

---

## Status: All 4 issues shipped ✅

| # | Title | Commit |
|---|---|---|
| [#37](https://github.com/khthana/grader/issues/37) | Schema + Repository: week release flag | `da24d7d` |
| [#38](https://github.com/khthana/grader/issues/38) | API: role-aware GET /weeks + isReleased toggle | `aa8eaec` |
| [#39](https://github.com/khthana/grader/issues/39) | WeekBar: lock/unlock toggle on week card | `68544a2` |
| [#40](https://github.com/khthana/grader/issues/40) | Problem page gate "ยังไม่เปิดรับ" | `6a02f7d` |

Plus post-ship fixes:
- `527fa12` — migration script `scripts/migrate-002-week-is-released.sql`
- `836e800` — lock icon moved to top-right, delete to top-left
- `c22b9c5` — icons brought inside card boundary

---

## What was built

- **`schema.sql`** — `is_released BOOLEAN NOT NULL DEFAULT FALSE` on `weeks`
- **`src/lib/weeks/repository.ts`** — `WeekRecord.isReleased`, `listWeeks(opts?)`, `setWeekReleased()`
- **`src/app/api/…/weeks/route.ts`** — GET filters by role (Student → releasedOnly)
- **`src/app/api/…/weeks/[wid]/route.ts`** — PUT accepts `{ topic?, isReleased? }`
- **`src/components/problems/WeekBar.tsx`** — `Week.isReleased`, lock/unlock button (top-right)
- **`src/app/(app)/…/problems/[week]/[no]/page.tsx`** — "ยังไม่เปิดรับ" gate for Students
- **`scripts/migrate-002-week-is-released.sql`** — idempotent ALTER for existing DBs

## Test count: 339 tests / 53 files (all pass)

---

## Deploy checklist

- [ ] Run `psql $DATABASE_URL -f scripts/migrate-002-week-is-released.sql` on production DB
- [ ] After deploy: Instructors must manually release Weeks — existing Weeks all default to hidden
- [ ] Fresh install: `db:setup` includes the column automatically

---

## Next session

No known blockers. Feature is complete and verified in dev.
