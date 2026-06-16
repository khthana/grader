import type { Queryable } from "./users/repository"

export type LogAction =
  | "user.create"
  | "user.update"
  | "user.delete"
  | "user.roles"
  | "login"
  | "enrollment.add"
  | "enrollment.update"
  | "enrollment.remove"
  | "enrollment.import"
  | "course.create"
  | "course.update"
  | "course.delete"
  | "course.staff"

export interface LogInput {
  actorId?: number | null
  actorEmail?: string | null
  action: LogAction
  targetId?: number | null
  targetEmail?: string | null
}

export interface LogEntry {
  id: number
  actorId: number | null
  actorEmail: string | null
  action: string
  targetId: number | null
  targetEmail: string | null
  createdAt: string
}

export interface ListLogsParams {
  action?: string
  page: number
  pageSize: number
}

interface LogRow {
  id: number
  actor_id: number | null
  actor_email: string | null
  action: string
  target_id: number | null
  target_email: string | null
  created_at: string
}

function toEntry(row: LogRow): LogEntry {
  return {
    id: row.id,
    actorId: row.actor_id,
    actorEmail: row.actor_email,
    action: row.action,
    targetId: row.target_id,
    targetEmail: row.target_email,
    createdAt: row.created_at,
  }
}

// Best-effort audit write: a logging failure must never break the operation.
export async function safeLog(db: Queryable, input: LogInput): Promise<void> {
  try {
    await writeLog(db, input)
  } catch (err) {
    console.error("audit log write failed", err)
  }
}

export async function writeLog(db: Queryable, input: LogInput): Promise<void> {
  await db.query(
    `INSERT INTO user_logs (actor_id, actor_email, action, target_id, target_email)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      input.actorId ?? null,
      input.actorEmail ?? null,
      input.action,
      input.targetId ?? null,
      input.targetEmail ?? null,
    ]
  )
}

export async function listLogs(
  db: Queryable,
  { action, page, pageSize }: ListLogsParams
): Promise<{ logs: LogEntry[]; total: number }> {
  const hasAction = !!action && action.trim() !== ""
  const where = hasAction ? `WHERE action = $1` : ``
  const filterParams = hasAction ? [action] : []

  const { rows: countRows } = await db.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM user_logs ${where}`,
    filterParams
  )
  const total = Number(countRows[0]?.count ?? 0)

  const limitIdx = filterParams.length + 1
  const offsetIdx = filterParams.length + 2
  const { rows } = await db.query<LogRow>(
    `SELECT id, actor_id, actor_email, action, target_id, target_email, created_at
     FROM user_logs ${where}
     ORDER BY id DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    [...filterParams, pageSize, (page - 1) * pageSize]
  )

  return { logs: rows.map(toEntry), total }
}
