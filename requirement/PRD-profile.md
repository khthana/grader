# PRD — User Profile Page

> CE-Grader — หน้าโปรไฟล์ส่วนตัว
> Domain glossary: `CONTEXT.md` · Architecture decisions: `docs/adr/`

---

## Problem Statement

ปัจจุบัน User ทุก role ไม่มีทางตั้งค่าข้อมูลส่วนตัวด้วยตัวเองได้เลย — รูปโปรไฟล์มาจาก Google เท่านั้น, ชื่อที่แสดงใน navbar ถูกตั้งโดย Admin เท่านั้น, และไม่มีช่องทางเปลี่ยนรหัสผ่านในระบบ (ต้องให้ Admin แก้ให้) ทำให้ User ขาดความเป็นเจ้าของข้อมูลส่วนตัวของตนเอง

## Solution

เพิ่มหน้า `/profile` ให้ User ทุก role เข้าถึงได้ ประกอบด้วย 2 section แยกกัน:

1. **ข้อมูลทั่วไป** — ตั้ง nickname (แสดงใน navbar แทนชื่อทางการ) และอัปโหลดรูปโปรไฟล์ (resize client-side ด้วย Canvas API → 256×256px → base64 → DB)
2. **เปลี่ยนรหัสผ่าน** — ยืนยันรหัสเดิมก่อน แล้วตั้งใหม่; disabled พร้อม note สำหรับ Google account

---

## User Stories

1. As a User, I want to access my profile page from the navbar dropdown, so that I can manage my personal settings without contacting an Admin.
2. As a User, I want to set a nickname, so that my preferred name appears in the navbar instead of my official name.
3. As a User, I want to upload a profile picture, so that I can personalise my account with a photo of my choice.
4. As a User, I want my uploaded picture to be automatically resized to 256×256px, so that I do not have to resize it myself before uploading.
5. As a User, I want the system to reject images larger than 150KB after resize, so that the database does not grow unnecessarily.
6. As a User, I want my official name (set by Admin) to be shown as read-only on the profile page, so that I understand the difference between my official name and nickname.
7. As a User, I want my email address to be shown as read-only on the profile page, so that I know which account I am logged in as.
8. As a User, I want my current role to be shown on the profile page, so that I can confirm my permissions at a glance.
9. As a User, I want my nickname to persist after I save, so that the navbar reflects my chosen name on every subsequent visit.
10. As a User, I want to clear my nickname (leave it blank), so that the system reverts to showing my official name in the navbar.
11. As a User with an email/password account, I want to change my password by entering my current password first, so that my account remains secure.
12. As a User with an email/password account, I want the new password to be validated against the existing policy (≥8 chars, letters + digits), so that I do not set a weak password.
13. As a User with an email/password account, I want to confirm my new password before saving, so that I do not accidentally save a typo.
14. As a User with a Google account, I want to see the password section disabled with a clear explanation, so that I understand why I cannot set a password here.
15. As a User, I want the general info section and the password section to save independently, so that I do not accidentally clear my new password when saving my nickname.
16. As a User, I want to see a success toast after each save, so that I know the change was persisted.
17. As a User, I want to see an error toast if my current password is wrong, so that I can correct it without losing my new password input.

---

## Implementation Decisions

### Schema
- Add `nickname TEXT` column to `users` table (nullable, no default).
- `picture` column already exists as `TEXT`; will now store base64 data URLs (e.g. `data:image/jpeg;base64,...`) in addition to Google photo URLs. No column type change needed.
- New idempotent migration script: `scripts/migrate-004-user-nickname.sql` (`ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname TEXT`).

### Navbar display name
- `layout.tsx` reads `getCurrentUser()` and passes `nickname ?? name` (instead of `name`) to AppShell → Navbar.
- `UserWithRoles` type and `getUserWithRoles` repository function must include `nickname: string | null`.

### Repository (`src/lib/users/repository.ts`)
- Add `nickname: string | null` to `UserWithRoles` and relevant DB projections.
- Add `updateProfile(db, userId, { nickname?: string | null; picture?: string | null }): Promise<void>` — focused update, no admin check inside.

### Validation (`src/lib/users/validation.ts`)
- Add `validateProfileInput({ nickname?, pictureBase64? })`:
  - nickname: optional, trim, max 50 chars
  - pictureBase64: optional; if present, must be a valid `data:image/...;base64,...` string, and decoded byte length ≤ 150 × 1024
- Add `validatePasswordChange({ currentPassword, newPassword, confirmPassword })`:
  - All three required
  - `newPassword` must satisfy existing policy (≥8 chars, letter + digit)
  - `newPassword === confirmPassword`
  - Returns `{ errors: Record<string, string> }`

### API (new — auth via `getUserFromRequest`, NOT admin-gated)

**`GET /api/profile`**
- Returns: `{ email, name, nickname, picture, roles, hasPassword: boolean }`
- `hasPassword` = `passwordHash !== null`

**`PUT /api/profile`**
- Body: `{ nickname?: string | null; picture?: string | null }`
- Validates with `validateProfileInput`; 400 on error
- Calls `updateProfile(db, userId, ...)`; 200 on success

**`PUT /api/profile/password`**
- Body: `{ currentPassword: string; newPassword: string; confirmPassword: string }`
- 400 if Google account (`hasPassword === false`)
- Validates with `validatePasswordChange`; 400 on field errors
- Verifies `currentPassword` against stored hash via `verifyPassword`; 400 `{ error: "รหัสผ่านเดิมไม่ถูกต้อง" }` on mismatch
- Hashes `newPassword` via `hashPassword`; updates `password_hash`; 200 on success

### Page & UI
- `src/app/(app)/profile/page.tsx` — Server Component; calls `getCurrentUser()`; renders `ProfileForm` + `PasswordForm`
- `src/components/profile/ProfileForm.tsx` — `'use client'`; avatar preview + canvas resize + nickname input + save button
- `src/components/profile/PasswordForm.tsx` — `'use client'`; 3-field password form + save button; disabled state for Google accounts
- Avatar canvas resize: on file select, draw to `<canvas width=256 height=256>` (cover crop), call `canvas.toDataURL("image/jpeg", 0.85)`, reject if decoded size > 150 × 1024 bytes
- Add `/profile` to `src/proxy.ts` `config.matcher`
- Add "โปรไฟล์" link in `src/components/shell/Navbar.tsx` dropdown (above "ออกจากระบบ")

### GitHub issues
- #47 — schema + nickname plumbing (no blockers)
- #48 — general info page (blocked by #47)
- #49 — password change section (blocked by #48)

---

## Testing Decisions

Good tests verify **external behavior through public interfaces**, not internal implementation. They use the existing Vitest + pg-mem stack with `setTestDb` injection.

**Modules to test:**

1. **`validateProfileInput` (pure)** — nickname too long → error; valid base64 within limit → ok; base64 over 150KB → error; invalid data URL format → error. Prior art: `src/lib/users/validation.test.ts`.

2. **`validatePasswordChange` (pure)** — missing fields → errors; weak new password → error; confirm mismatch → error; all valid → no errors. Same file.

3. **`GET /api/profile` route** — authenticated user gets their own data including `hasPassword` flag; unauthenticated → 401. Prior art: `src/app/api/users/[id]/route.test.ts`.

4. **`PUT /api/profile` route** — valid nickname update → 200 + persisted; nickname too long → 400; unauthenticated → 401.

5. **`PUT /api/profile/password` route** — correct current password + valid new → 200; wrong current password → 400; Google account (no hash) → 400; weak new password → 400.

**Not tested with Vitest:** UI components (`ProfileForm`, `PasswordForm`) — no jsdom in this project; verified via `/verify` in browser.

---

## Out of Scope

- **Admin editing another user's nickname or picture** — Admin uses User Management for official fields; nickname/picture are self-service only.
- **Interactive crop UI for avatar** — canvas cover-crops to 256×256 automatically; no crop control in v1.
- **Avatar CDN / external storage** — base64 in `picture` column only; no S3/R2 in v1.
- **Email change** — email is the login identity; change must go through Admin.
- **Deleting account** — out of scope.
- **Google account password set** — users who signed up via Google cannot set a local password in v1.

---

## Further Notes

- `picture` column will contain mixed values post-deploy: Google photo URLs and base64 data URLs. The `<img src={picture}>` pattern in Navbar already handles both transparently.
- After saving nickname or picture, the navbar reflects the change on the next full page load (Server Component re-render). No optimistic client-side update in v1.
- Migration script follows the established `scripts/migrate.ts` runner pattern (no psql required): `DATABASE_URL=... npx tsx scripts/migrate.ts scripts/migrate-004-user-nickname.sql`.
