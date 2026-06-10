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
    `INSERT INTO users (email, name, password_hash, picture)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, name, password_hash, picture, is_active`,
    [normalizeEmail(input.email), input.name, input.passwordHash ?? null, input.picture ?? null]
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
