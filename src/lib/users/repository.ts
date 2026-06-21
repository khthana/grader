// User repository — raw SQL over a `pg`-compatible client.
// Functions take an injectable `Queryable` so production passes a real pool
// and tests pass a pg-mem adapter.

import type { Queryable } from "@/lib/db"
export type { Queryable }

export interface NewUser {
  email: string
  name: string
  passwordHash?: string | null
  picture?: string | null
  idCode?: string | null
  titleTh?: string | null
  firstNameTh?: string | null
  lastNameTh?: string | null
  titleEn?: string | null
  firstNameEn?: string | null
  lastNameEn?: string | null
  phone?: string | null
}

export interface UserDetail {
  id: number
  email: string
  name: string
  titleTh: string | null
  firstNameTh: string | null
  lastNameTh: string | null
  titleEn: string | null
  firstNameEn: string | null
  lastNameEn: string | null
  phone: string | null
  idCode: string | null
  picture: string | null
  isActive: boolean
  roles: string[]
}

export interface UserRecord {
  id: number
  email: string
  name: string
  nickname: string | null
  passwordHash: string | null
  picture: string | null
  isActive: boolean
}

export interface UserWithRoles {
  id: number
  email: string
  name: string
  nickname: string | null
  picture: string | null
  isActive: boolean
  roles: string[]
}

export interface UserListItem {
  id: number
  name: string
  email: string
  idCode: string | null
  isActive: boolean
  roles: string[]
}

export interface ListUsersParams {
  search: string
  page: number
  pageSize: number
}

export interface UserListPage {
  users: UserListItem[]
  total: number
}

interface UserRow {
  id: number
  email: string
  name: string
  nickname: string | null
  password_hash: string | null
  picture: string | null
  is_active: boolean
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function toRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.password_hash,
    picture: row.picture,
    isActive: row.is_active,
    nickname: row.nickname,
  }
}

export async function createUser(db: Queryable, input: NewUser): Promise<UserRecord> {
  const { rows } = await db.query<UserRow>(
    `INSERT INTO users
       (email, name, password_hash, picture, id_code,
        title_th, first_name_th, last_name_th,
        title_en, first_name_en, last_name_en, phone)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING id, email, name, nickname, password_hash, picture, is_active`,
    [
      normalizeEmail(input.email),
      input.name,
      input.passwordHash ?? null,
      input.picture ?? null,
      input.idCode ?? null,
      input.titleTh ?? null,
      input.firstNameTh ?? null,
      input.lastNameTh ?? null,
      input.titleEn ?? null,
      input.firstNameEn ?? null,
      input.lastNameEn ?? null,
      input.phone ?? null,
    ]
  )
  return toRecord(rows[0])
}

export async function findUserByEmail(
  db: Queryable,
  email: string
): Promise<UserRecord | null> {
  const { rows } = await db.query<UserRow>(
    `SELECT id, email, name, nickname, password_hash, picture, is_active
     FROM users WHERE email = $1`,
    [normalizeEmail(email)]
  )
  return rows[0] ? toRecord(rows[0]) : null
}

// Find a user by their รหัสนักศึกษา / staff id. Blank ids never match (legacy
// users with a NULL id_code must not be reused by the enroll find-or-create).
export async function findUserByIdCode(
  db: Queryable,
  idCode: string
): Promise<UserRecord | null> {
  if (!idCode || idCode.trim() === "") return null
  const { rows } = await db.query<UserRow>(
    `SELECT id, email, name, nickname, password_hash, picture, is_active
     FROM users WHERE id_code = $1`,
    [idCode.trim()]
  )
  return rows[0] ? toRecord(rows[0]) : null
}

export async function getUserWithRoles(
  db: Queryable,
  id: number
): Promise<UserWithRoles | null> {
  const { rows } = await db.query<UserRow>(
    `SELECT id, email, name, nickname, password_hash, picture, is_active
     FROM users WHERE id = $1`,
    [id]
  )
  if (!rows[0]) return null

  const { rows: roleRows } = await db.query<{ name: string }>(
    `SELECT r.name FROM roles r
     JOIN user_roles ur ON ur.role_id = r.id
     WHERE ur.user_id = $1
     ORDER BY r.name`,
    [id]
  )

  const user = toRecord(rows[0])
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    nickname: user.nickname,
    picture: user.picture,
    isActive: user.isActive,
    roles: roleRows.map((r) => r.name),
  }
}

export interface UpdateUser {
  email: string
  name: string
  idCode?: string | null
  phone?: string | null
  titleTh?: string | null
  firstNameTh?: string | null
  lastNameTh?: string | null
  titleEn?: string | null
  firstNameEn?: string | null
  lastNameEn?: string | null
}

export async function updateUser(
  db: Queryable,
  id: number,
  input: UpdateUser
): Promise<UserDetail | null> {
  const { rows } = await db.query<{ id: number }>(
    `UPDATE users SET
       email = $2, name = $3, id_code = $4, phone = $5,
       title_th = $6, first_name_th = $7, last_name_th = $8,
       title_en = $9, first_name_en = $10, last_name_en = $11,
       updated_at = now()
     WHERE id = $1
     RETURNING id`,
    [
      id,
      normalizeEmail(input.email),
      input.name,
      input.idCode ?? null,
      input.phone ?? null,
      input.titleTh ?? null,
      input.firstNameTh ?? null,
      input.lastNameTh ?? null,
      input.titleEn ?? null,
      input.firstNameEn ?? null,
      input.lastNameEn ?? null,
    ]
  )
  if (!rows[0]) return null
  return getUserById(db, id)
}

export interface UpdateUserName {
  name: string
  titleTh?: string | null
  firstNameTh?: string | null
  lastNameTh?: string | null
}

// Focused update of a user's display name + Thai prefix/first/last only.
// Leaves email and id_code (identity) untouched — used by roster editing where
// รหัสนักศึกษา is read-only.
export async function updateUserName(
  db: Queryable,
  id: number,
  input: UpdateUserName
): Promise<boolean> {
  const { rows } = await db.query<{ id: number }>(
    `UPDATE users SET
       name = $2, title_th = $3, first_name_th = $4, last_name_th = $5,
       updated_at = now()
     WHERE id = $1
     RETURNING id`,
    [
      id,
      input.name,
      input.titleTh ?? null,
      input.firstNameTh ?? null,
      input.lastNameTh ?? null,
    ]
  )
  return rows.length > 0
}

export async function updateProfile(
  db: Queryable,
  userId: number,
  changes: { nickname?: string | null; picture?: string | null }
): Promise<void> {
  const sets: string[] = []
  const params: unknown[] = [userId]
  if ("nickname" in changes) {
    params.push(changes.nickname)
    sets.push(`nickname = $${params.length}`)
  }
  if ("picture" in changes) {
    params.push(changes.picture)
    sets.push(`picture = $${params.length}`)
  }
  if (sets.length === 0) return
  sets.push("updated_at = now()")
  await db.query(
    `UPDATE users SET ${sets.join(", ")} WHERE id = $1`,
    params
  )
}

export async function deleteUser(db: Queryable, id: number): Promise<boolean> {
  const { rows } = await db.query<{ id: number }>(
    `DELETE FROM users WHERE id = $1 RETURNING id`,
    [id]
  )
  return rows.length > 0
}

export async function setUserActive(
  db: Queryable,
  id: number,
  isActive: boolean
): Promise<boolean> {
  const { rows } = await db.query<{ id: number }>(
    `UPDATE users SET is_active = $2, updated_at = now() WHERE id = $1 RETURNING id`,
    [id, isActive]
  )
  return rows.length > 0
}

export async function assignRole(
  db: Queryable,
  userId: number,
  roleName: string
): Promise<void> {
  await db.query(
    `INSERT INTO user_roles (user_id, role_id)
     SELECT $1::int, r.id FROM roles r WHERE r.name = $2
     ON CONFLICT (user_id, role_id) DO NOTHING`,
    [userId, roleName]
  )
}

// Replace a user's entire role set with `roles` (assign missing, revoke dropped).
export async function setUserRoles(
  db: Queryable,
  userId: number,
  roles: string[]
): Promise<void> {
  await db.query(`DELETE FROM user_roles WHERE user_id = $1`, [userId])
  for (const role of roles) {
    await assignRole(db, userId, role)
  }
}

export async function countUsersWithRole(db: Queryable, roleName: string): Promise<number> {
  const { rows } = await db.query<{ count: number }>(
    `SELECT COUNT(DISTINCT ur.user_id)::int AS count
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE r.name = $1`,
    [roleName]
  )
  return Number(rows[0]?.count ?? 0)
}

interface UserListRow {
  id: number
  name: string
  email: string
  id_code: string | null
  is_active: boolean
}

// Fetch role names for a set of user ids, grouped per user.
async function rolesByUserId(
  db: Queryable,
  ids: number[]
): Promise<Map<number, string[]>> {
  const grouped = new Map<number, string[]>()
  if (ids.length === 0) return grouped

  const placeholders = ids.map((_, i) => `$${i + 1}`).join(",")
  const { rows } = await db.query<{ user_id: number; name: string }>(
    `SELECT ur.user_id, r.name
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id IN (${placeholders})
     ORDER BY r.name`,
    ids
  )
  for (const row of rows) {
    const list = grouped.get(row.user_id) ?? []
    list.push(row.name)
    grouped.set(row.user_id, list)
  }
  return grouped
}

export async function listUsers(
  db: Queryable,
  { search, page, pageSize }: ListUsersParams
): Promise<UserListPage> {
  const hasSearch = search.trim() !== ""
  const where = hasSearch
    ? `WHERE u.name ILIKE $1 OR u.email ILIKE $1 OR u.id_code ILIKE $1`
    : ``
  const searchParams = hasSearch ? [`%${search.trim()}%`] : []

  const { rows: countRows } = await db.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM users u ${where}`,
    searchParams
  )
  const total = Number(countRows[0]?.count ?? 0)

  const limitIdx = searchParams.length + 1
  const offsetIdx = searchParams.length + 2
  const { rows } = await db.query<UserListRow>(
    `SELECT u.id, u.name, u.email, u.id_code, u.is_active
     FROM users u ${where}
     ORDER BY u.id
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    [...searchParams, pageSize, (page - 1) * pageSize]
  )

  const roleMap = await rolesByUserId(db, rows.map((r) => r.id))
  const users: UserListItem[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    idCode: r.id_code,
    isActive: r.is_active,
    roles: roleMap.get(r.id) ?? [],
  }))

  return { users, total }
}

interface UserDetailRow {
  id: number
  email: string
  name: string
  title_th: string | null
  first_name_th: string | null
  last_name_th: string | null
  title_en: string | null
  first_name_en: string | null
  last_name_en: string | null
  phone: string | null
  id_code: string | null
  picture: string | null
  is_active: boolean
}

export async function getUserById(db: Queryable, id: number): Promise<UserDetail | null> {
  const { rows } = await db.query<UserDetailRow>(
    `SELECT id, email, name, title_th, first_name_th, last_name_th,
            title_en, first_name_en, last_name_en, phone, id_code, picture, is_active
     FROM users WHERE id = $1`,
    [id]
  )
  const row = rows[0]
  if (!row) return null

  const roleMap = await rolesByUserId(db, [row.id])
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    titleTh: row.title_th,
    firstNameTh: row.first_name_th,
    lastNameTh: row.last_name_th,
    titleEn: row.title_en,
    firstNameEn: row.first_name_en,
    lastNameEn: row.last_name_en,
    phone: row.phone,
    idCode: row.id_code,
    picture: row.picture,
    isActive: row.is_active,
    roles: roleMap.get(row.id) ?? [],
  }
}
