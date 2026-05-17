import { NextRequest, NextResponse } from 'next/server'

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
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  const loginWithError = (reason: string) =>
    NextResponse.redirect(new URL(`/login?error=${reason}`, req.url))

  if (error || !code) {
    return loginWithError('google_cancelled')
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

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

  // TODO: validate that user.email is registered in the system,
  // then create a signed session token and set it as an HttpOnly cookie.
  // For now we store a minimal session payload (replace with a signed JWT).
  const session = Buffer.from(JSON.stringify({ email: user.email, name: user.name, picture: user.picture })).toString('base64')

  const response = NextResponse.redirect(new URL('/', req.url))
  response.cookies.set('session', session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8, // 8 hours
  })
  return response
}
