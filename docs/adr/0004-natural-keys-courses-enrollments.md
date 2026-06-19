# 4. Natural composite PKs on courses and enrollments

Date: 2026-06-19

## Status

Accepted

## Context

The original schema gave `courses` a `SERIAL` surrogate `id`, and `enrollments` a surrogate `id` as well. This created three problems:

1. **URLs were opaque.** `/problems/4/edit?courseId=2` — the numbers tell the user nothing about which course or problem they are viewing.
2. **Same course code across years was impossible.** Course `01076105` is offered every year and semester; a single natural identity column `code` is not unique without `year` and `semester`.
3. **`courseId` querystring was a dead parameter.** The server ignored `?courseId=` and resolved course from a cookie instead — misleading and fragile.

## Decision

Replace surrogate PKs on `courses` and `enrollments` with natural composite keys:

| Table | Old PK | New PK |
|-------|--------|--------|
| `courses` | `id SERIAL` | `(code, year, semester)` |
| `course_instructors` | `(course_id, user_id)` | `(course_code, course_year, course_semester, user_id)` |
| `enrollments` | `id SERIAL` | `(course_code, course_year, course_semester, user_id)` |

`year` is the Thai Buddhist year (พ.ศ., e.g. 2567). `semester` ∈ {1, 2, 3}.

`weeks` and `problems` keep surrogate `id` PKs and carry the course FK as three columns — this limits cascade depth and means test_cases / submissions are not affected by course renames.

`problems` gains a `problem_no INTEGER` column: a per-week sequential number auto-assigned at insert time (`MAX(problem_no) + 1 WITHIN week_id`), enforced by `UNIQUE (week_id, problem_no)`.

### URL structure after the change

```
/courses/01076105/2567/1/problems          ← week listing
/courses/01076105/2567/1/problems/1/2      ← week 1, problem 2
/courses/01076105/2567/1/problems/1/2/edit
/courses/01076105/2567/1/students
/courses/01076105/2567/1/gradebook
/courses/01076105/2567/1/review
/courses/01076105/2567/1/assignments
```

Old shortcut paths (`/problems`, `/students`, etc.) are kept as thin Server Component redirectors that read the `active_course` cookie and redirect to the full course-scoped URL.

### Shared type

```typescript
// src/lib/courses/types.ts
export interface CourseKey { code: string; year: number; semester: number }
export interface CourseRecord extends CourseKey { nameTh: string; nameEn: string; program: string | null; createdAt: string }
```

All repository functions that previously took `courseId: number` now take `key: CourseKey` or accept `{ courseCode, courseYear, courseSemester }` on input objects.

### Client API call convention

Client components receive `courseSlug: string` (e.g. `"01076105/2567/1"`) for constructing fetch paths, and `coursePath: string` (e.g. `"/courses/01076105/2567/1"`) for `<Link href>`. They never hold a numeric ID.

### Dev DB migration

`scripts/migrate-001-natural-keys.sql` handles the one-time migration of an existing populated database (drop old FKs → add year/semester columns → backfill → swap PK → re-add FKs → add `problem_no`).

## Consequences

**Positive**
- URLs are self-describing and bookmarkable.
- Course offerings across years are natively modelled — no workaround needed.
- No dead query parameters; the course identity is always in the URL path.
- `problem_no` enables human-readable problem URLs without depending on insertion order of the surrogate `id`.

**Negative / costs**
- Three-column FK is verbose but tolerated — only courses and enrollments are affected; weeks/problems/submissions still use surrogate IDs internally.
- `db:setup` (idempotent `CREATE TABLE IF NOT EXISTS`) cannot apply mid-stream changes; existing dev DBs need the migration script.
- All repository call sites needed updating (completed in the same commit, 308 tests passing).
