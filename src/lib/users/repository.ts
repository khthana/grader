// User repository — raw SQL over a `pg`-compatible client.
// Functions take an injectable `Queryable` so production passes a real pool
// and tests pass a pg-mem adapter.

export interface Queryable {
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: T[] }>
}

export interface NewUser {
  email: string
  name: string
  passwordHash?: string | null
  picture?: string | null
  idCode?: string | null
}

export interface UserRecord {
  id: number
  email: string
  name: string
  passwordHash: string | null
  picture: string | null
  isActive: boolean
}

export interface UserWithRoles {
  id: number
  email: string
  name: string
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
  }
}

export async function createUser(db: Queryable, input: NewUser): Promise<UserRecord> {
  const { rows } = await db.query<UserRow>(
    `INSERT INTO users (email, name, password_hash, picture, id_code)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, email, name, password_hash, picture, is_active`,
    [
      normalizeEmail(input.email),
      input.name,
      input.passwordHash ?? null,
      input.picture ?? null,
      input.idCode ?? null,
    ]
  )
  return toRecord(rows[0])
}

export async function findUserByEmail(
  db: Queryable,
  email: string
): Promise<UserRecord | null> {
  const { rows } = await db.query<UserRow>(
    `SELECT id, email, name, password_hash, picture, is_active
     FROM users WHERE email = $1`,
    [normalizeEmail(email)]
  )
  return rows[0] ? toRecord(rows[0]) : null
}

export async function getUserWithRoles(
  db: Queryable,
  id: number
): Promise<UserWithRoles | null> {
  const { rows } = await db.query<UserRow>(
    `SELECT id, email, name, password_hash, picture, is_active
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
    picture: user.picture,
    isActive: user.isActive,
    roles: roleRows.map((r) => r.name),
  }
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
