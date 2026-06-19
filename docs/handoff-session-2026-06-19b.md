# CE-Grader Handoff — 2026-06-19 (Session B)

## Project location
`C:\Users\Terry\Desktop\Code\grader`
Branch: `main` (commit directly, no PRs)

## Current state

Feature-complete. 308 tests / 48 files, all passing. Run with `npm test`.

---

## What was done this session

### 1. Dev DB migration applied

The dev database still had the old schema (no `year`/`semester` columns on `courses`).
The migration script was updated to backfill `year=2569` (was `2567`) and applied:

```
psql $DATABASE_URL -f scripts/migrate-001-natural-keys.sql
```

File changed: `scripts/migrate-001-natural-keys.sql` line 10 — `DEFAULT 2567` → `DEFAULT 2569`.

### 2. Sidebar active-state bug fixed

**Bug:** When on a course-scoped page (e.g. `/courses/01076105/2569/1/problems`), the "รายวิชา" menu item (href=`/courses`) was also highlighted because `pathname.startsWith("/courses/")` matched.

**Fix:** `src/components/shell/Sidebar.tsx`
- Imported `isCourseScopedPath` from `@/lib/courses/scope`
- Changed active check: for non-`courseScoped` items, the prefix match is suppressed when `isCourseScopedPath(pathname)` is true

```typescript
const prefixMatch = pathname.startsWith(item.href + "/") &&
  (item.courseScoped || !isCourseScopedPath(pathname))
const active = pathname === item.href || prefixMatch
```

### 3. Markdown support for problem description

**Feature:** `description` field on problems now renders as GFM Markdown (tables, bold, italic, code, lists).

**Packages added:**
- `react-markdown` — React renderer, RSC-compatible, safe by default
- `remark-gfm` — GFM tables, strikethrough, task lists
- `@tailwindcss/typography` — `prose` class for styled output

**Files changed:**

| File | Change |
|------|--------|
| `src/app/globals.css` | Added `@plugin "@tailwindcss/typography"` |
| `src/components/ui/MarkdownContent.tsx` | New component — renders Markdown with `prose prose-slate` |
| `src/app/(app)/courses/[code]/[year]/[semester]/problems/[week]/[no]/page.tsx` | Replaced `<p whitespace-pre-wrap>` with `<MarkdownContent>` |
| `src/components/problems/ProblemEditor.tsx` | Added `descTab` state + Write/Preview tab toggle on description field |

**Scope:** description only — `input_spec` and `output_spec` remain as `<pre>` plain text (intentional).

**No raw HTML support** — `react-markdown` default safe mode (no `rehype-raw`).

---

## Known pre-existing TypeScript errors (NOT from this session)

Running `npx tsc --noEmit` shows errors that existed before this session:

- `.next/types/validator.ts` — stale Next.js type cache pointing at deleted `[id]/` routes; resolves after `next build`
- `scripts/setup-db.ts` — still uses old `createCourse` without `year`/`semester` (noted in prior handoff)
- `src/components/editor/CodeEditor.tsx:124` — `r.score` on `TestResult` which has no `score` field
- `src/app/(app)/courses/.../problems/[week]/[no]/page.tsx:54` — `tc.score` on `TestCaseRecord`
- `src/lib/gradebook/export.test.ts` — `problemNo` missing in test fixtures
- `src/lib/enrollments/export.test.ts` — `id` not on `EnrollmentListItem`

---

## Uncommitted changes (not yet committed this session)

All changes from this session are **uncommitted**. Files modified:

- `scripts/migrate-001-natural-keys.sql`
- `src/app/globals.css`
- `src/components/shell/Sidebar.tsx`
- `src/components/problems/ProblemEditor.tsx`
- `src/app/(app)/courses/[code]/[year]/[semester]/problems/[week]/[no]/page.tsx`
- `src/components/ui/MarkdownContent.tsx` (new)

---

## Pending work (carry-forward from prior sessions)

- **Fix TypeScript bugs** — `r.score` in `CodeEditor.tsx:124`; `tc.score` in problem page:54; `problemNo` missing in gradebook export test fixtures; `id` in enrollment export test
- **Update seed scripts** — `scripts/seed-lab1.js` and `scripts/setup-db.ts` still use old `createCourse` without `year`/`semester`
- **New API route test files** — `[code]/[year]/[semester]/` route handlers have no test files (deleted with old `[id]/` tests); route logic unchanged, `courseRoute` wrapper already tested
- **Hydration error** — was being investigated but not reproduced/confirmed; exact page and browser diff still unknown

---

## Architecture reference

See `CLAUDE.md` (kept current).
See `docs/adr/` for design rationale.
See `docs/handoff-session-2026-06-19.md` for the natural-key migration handoff.

---

## Suggested skills for next session

- `/grill-me <feature>` — to design any new feature before implementing
- `/handoff` — to close out the session
