# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
ระบบตรวจและให้คะแนน Python code ของนักศึกษาอัตโนมัติ — นักศึกษาส่ง Python code เข้ามา ระบบรัน ตรวจสอบกับ test cases และให้คะแนนพร้อม feedback

## Commands
- `npm run dev` — start dev server (Turbopack)
- `npm run build` — production build
- `npm run lint` — ESLint

## Architecture

### Data Flow (Grading)
1. Student submits Python code via `CodeEditor` (client component)
2. `POST /api/grade` receives `{ problemId, code, language }`
3. API calls Piston API (`https://emkc.org/api/v2/piston/execute`) once per test case
4. Results compared against `expectedOutput` (trimmed string match)
5. Score = `(passedTests / totalTests) * 100`

### Key Files
- `src/app/problems/[id]/page.tsx` — Server Component; problem data is hardcoded in the `problems` map here
- `src/app/api/grade/route.ts` — POST handler; test cases are also hardcoded in a `problems` map here
- `src/lib/piston.ts` — Piston API client; runs Python 3.10.0 with optional stdin
- `src/components/editor/CodeEditor.tsx` — `'use client'`; textarea + submit button + result display
- `src/types/index.ts` — shared TypeScript interfaces (`Problem`, `TestCase`, `TestResult`, `GradeResult`, `SubmissionRequest`)
- `src/app/login/page.tsx` — `'use client'`; login page with Google OAuth button + email/password form
- `src/app/api/auth/google/route.ts` — redirects browser to Google OAuth consent screen
- `src/app/api/auth/callback/google/route.ts` — exchanges OAuth code for tokens, sets session cookie, redirects to `/`
- `src/app/globals.css` — Tailwind v4 `@theme` block with brand color tokens (`primary`, `primary-hover`, `secondary`, `secondary-hover`) and Noto Sans Thai font

### Adding a New Problem
Problem data is currently duplicated — must be added in **both** places:
1. `src/app/problems/[id]/page.tsx` → add entry to the `problems` map (title, description, examples)
2. `src/app/api/grade/route.ts` → add entry to the `problems` map (testCases with expectedOutput)

### Authentication Flow
1. `GET /` → 302 redirect to `/login` (configured in `next.config.ts`)
2. User clicks "Login with Google" → `GET /api/auth/google` → redirect to Google consent screen
3. Google redirects to `GET /api/auth/callback/google?code=…`
4. Callback exchanges code for tokens, fetches user profile, sets `session` HttpOnly cookie, redirects to `/`
5. On cancellation/error, Google redirects with `?error=…` → callback redirects to `/login?error=google_cancelled`
6. Email/password login: `POST /api/auth/login` (route not yet implemented — placeholder only)

**Session cookie:** Currently stored as base64-encoded JSON (`{ email, name, picture }`). **Not cryptographically signed — must be replaced with a signed JWT (e.g. `jose` library) before production.**

### Environment Variables
Required in `.env.local`:
```
GOOGLE_CLIENT_ID=        # from Google Cloud Console → APIs & Services → Credentials
GOOGLE_CLIENT_SECRET=    # same OAuth client
NEXTAUTH_URL=            # base URL, e.g. http://localhost:3000
```
Authorized redirect URI to register in Google Cloud Console: `{NEXTAUTH_URL}/api/auth/callback/google`

## Conventions
- Server Components by default; `'use client'` required for interactive components
- `@/*` path alias resolves to `src/*` (configured in `tsconfig.json`)
- All routes live under `src/app/` — there is no root-level `app/` directory
- Tailwind CSS v4 with `@import "tailwindcss"` in `globals.css`; custom brand tokens defined via `@theme` in that file (not `tailwind.config.ts`)
- Icons: inline SVG only — `react-icons`, `framer-motion`, and MUI are listed in `design.md` but **not installed**
