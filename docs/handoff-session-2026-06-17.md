# Session handoff — 2026-06-17

A fresh-agent handoff for the conversation that ended here. For project architecture and the
feature history, read **`CLAUDE.md`** and **`docs/handoff.md`** (both refreshed this session) —
this file only captures what those don't.

## Repo state
- Branch `main`, all work committed & pushed. HEAD = `70f82ce` (`docs: document admin impersonation + refresh handoff`).
- All GitHub issues closed, including the Admin impersonation epic (#27 parent, #28 enter, #29 exit).
- Test suite: **362 tests / 62 files**, green (`npx vitest run`).

## Live thread (unresolved) — Next.js hydration error

The user reported a hydration mismatch (full text: *"A tree hydrated but some attributes of the
server rendered HTML didn't match the client properties…"*). **Investigation is mid-flight; no fix
applied yet** because the code audit came back clean and the cause is most likely external.

**What was already ruled out (do not re-audit from scratch):**
- All `toLocaleString("th-TH")` / `new Date()` formatters are **not** in SSR HTML:
  - List views (`AssignmentsList`, `LogsView`, `PendingQueue`, `SubmissionsTable`) fetch in
    `useEffect` — SSR renders only "กำลังโหลด...", dates appear client-side after mount.
  - `src/app/(app)/problems/[id]/page.tsx` is an async **Server Component** — its `formatDate` /
    `new Date()` run server-only, no client recompute.
- No shell client component reads `window`/`document`/`localStorage` during render (only inside
  event handlers — `Navbar.tsx`, `ImpersonationBanner.tsx`).
- `src/app/layout.tsx` is static: `<html lang="th">` + `<body suppressHydrationWarning>` (already
  guards extension-injected `<body>` attributes).

**Leading hypothesis:** a **browser extension** mutating the DOM before React loads (the error
explicitly lists this; it says *attributes* mismatched, not text). Common offenders: Grammarly
(`data-gr-*`), Google Translate, Dark Reader (`style`), password managers — plausible given the
user works in Thai and may run a translation/dictionary extension.

**Next step (waiting on the user):** they were asked to
1. reopen the same page in **Incognito with extensions off** — if the error disappears it's an
   extension (no code change needed);
2. otherwise paste the **exact red/green element diff** the console prints **and the route**, so the
   specific component can be fixed.

Resume by acting on whichever of those two the user reports.

## Other open items (minor, captured elsewhere — just don't forget)
- **Cosmetic:** commit `2641fb5` (#28) carries a stray leading `@ ` in its subject **on the remote**
  (a here-string quoting slip in the Bash tool). Code is correct. Fixing needs a force-push, which
  the auto-approver blocks under a plain "commit + push" mandate — only do it if the user explicitly
  asks. Root cause + prevention are recorded in `docs/handoff.md` and in memory
  `git-direct-to-main-commit-after-slice.md`.
- **Environment (not a code bug):** Warp terminal does not render Thai combining marks (สระบน/ล่าง,
  วรรณยุกต์) — confirmed open Warp bug [#8357](https://github.com/warpdotdev/Warp/issues/8357),
  no in-app setting/font fix. Recommended workaround: run Claude Code in **Windows Terminal** for
  Thai input. User has not yet asked for WT setup; offer it if they raise the terminal issue again.

## Suggested skills
- No skill is needed for the live hydration thread — it's interactive debugging; respond directly
  once the user returns with the Incognito result / console diff.
- `/tdd #<n>` — if the user opens a new feature slice (create the GitHub issue first; one issue at a time).
- `/to-prd` → `/to-issues` — if a new feature concept needs specifying and breaking down.

## Working conventions (this user)
- Commit straight to `main`; user says **"commit + push"** per finished slice. Use a **PowerShell**
  here-string for multi-line commit messages — never the `@'…'@` form in the Bash tool (it injects a
  literal `@`). Trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Close GitHub
  issues manually with a comment referencing the commit hash.
- `npx vitest run` works; `npm test` may fail (PATH quirk on this machine).
