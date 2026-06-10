import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-guard"
import { getDb } from "@/lib/db"
import {
  listUsers,
  createUser,
  findUserByEmail,
  getUserById,
  assignRole,
} from "@/lib/users/repository"
import { validateUserInput, type UserInput } from "@/lib/users/validation"
import { hashPassword } from "@/lib/password"

const DEFAULT_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 100

function parsePositiveInt(value: string | null, fallback: number, max?: number): number {
  const n = Number.parseInt(value ?? "", 10)
  if (!Number.isFinite(n) || n < 1) return fallback
  return max ? Math.min(n, max) : n
}

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request)
  if (!guard.ok) return guard.response

  const { searchParams } = new URL(request.url)
  const search = searchParams.get("search") ?? ""
  const page = parsePositiveInt(searchParams.get("page"), 1)
  const pageSize = parsePositiveInt(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)

  const { users, total } = await listUsers(getDb(), { search, page, pageSize })
  return NextResponse.json({ users, total, page, pageSize })
}

function displayName(input: UserInput): string {
  return `${input.firstNameTh.trim()} ${input.lastNameTh.trim()}`.trim()
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request)
  if (!guard.ok) return guard.response

  const body = (await request.json().catch(() => ({}))) as Partial<UserInput>
  const input = {
    titleTh: body.titleTh,
    firstNameTh: body.firstNameTh ?? "",
    lastNameTh: body.lastNameTh ?? "",
    titleEn: body.titleEn,
    firstNameEn: body.firstNameEn,
    lastNameEn: body.lastNameEn,
    email: body.email ?? "",
    phone: body.phone,
    idCode: body.idCode ?? "",
    password: body.password,
    roles: body.roles,
  } satisfies UserInput

  const { valid, errors } = validateUserInput(input)
  if (!valid) return NextResponse.json({ errors }, { status: 400 })

  const db = getDb()
  if (await findUserByEmail(db, input.email)) {
    return NextResponse.json({ errors: { email: "อีเมลนี้ถูกใช้งานแล้ว" } }, { status: 409 })
  }

  const passwordHash = input.password ? await hashPassword(input.password) : null
  const user = await createUser(db, {
    email: input.email,
    name: displayName(input),
    passwordHash,
    idCode: input.idCode,
    titleTh: input.titleTh,
    firstNameTh: input.firstNameTh,
    lastNameTh: input.lastNameTh,
    titleEn: input.titleEn,
    firstNameEn: input.firstNameEn,
    lastNameEn: input.lastNameEn,
    phone: input.phone,
  })

  for (const role of input.roles ?? []) {
    await assignRole(db, user.id, role)
  }

  const detail = await getUserById(db, user.id)
  return NextResponse.json(detail, { status: 201 })
}
