import { NextRequest, NextResponse } from 'next/server'
import { createSessionToken, SESSION_COOKIE_OPTIONS } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { findUserByEmail } from '@/lib/users/repository'
import { OAUTH_STATE_COOKIE, OAUTH_STATE_COOKIE_OPTIONS, oauthStateMatches } from '@/lib/oauth-state'

interface GoogleTokenResponse {
  access_token: string
  id_token: string
  token_type: string
  expires_in: number
}

interface GoogleUserInfo {
  sub: string
  email: string
  name: string
  picture: string
}

export async function GET(req: NextRequest) {
  // The state cookie is single-use: clear it on every way out of the callback.
  const response = await handleCallback(req)
  response.cookies.set(OAUTH_STATE_COOKIE, '', { ...OAUTH_STATE_COOKIE_OPTIONS, maxAge: 0 })
  return response
}

async function handleCallback(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

  const loginWithError = (reason: string) =>
    NextResponse.redirect(new URL(`/login?error=${reason}`, baseUrl))

  // Login CSRF (#76): only finish a flow this browser started. Checked before
  // anything else, so a forged callback never reaches Google or the DB.
  if (!oauthStateMatches(req.cookies.get(OAUTH_STATE_COOKIE)?.value, searchParams.get('state'))) {
    return loginWithError('invalid_state')
  }

  if (error || !code) {
    return loginWithError('google_cancelled')
  }

  if (!clientId || !clientSecret) {
    return loginWithError('server_error')
  }

  // Exchange code for tokens
  let tokens: GoogleTokenResponse
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${baseUrl}/api/auth/callback/google`,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenRes.ok) return loginWithError('google_cancelled')
    tokens = await tokenRes.json()
  } catch {
    return loginWithError('server_error')
  }

  // Fetch user profile
  let user: GoogleUserInfo
  try {
    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    if (!userRes.ok) return loginWithError('server_error')
    user = await userRes.json()
  } catch {
    return loginWithError('server_error')
  }

  let userRecord
  try {
    userRecord = await findUserByEmail(getDb(), user.email)
  } catch {
    return loginWithError('server_error')
  }
  if (!userRecord) {
    return loginWithError('not_registered')
  }
  if (!userRecord.isActive) {
    return loginWithError('inactive')
  }

  const sessionToken = createSessionToken({
    email: userRecord.email,
    name: userRecord.name,
    picture: userRecord.picture ?? undefined,
  })

  const response = NextResponse.redirect(new URL('/', baseUrl))
  response.cookies.set('session', sessionToken, SESSION_COOKIE_OPTIONS)
  return response
}
