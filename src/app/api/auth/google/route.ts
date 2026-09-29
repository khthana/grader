import { NextResponse } from 'next/server'
import { createOAuthState, OAUTH_STATE_COOKIE, OAUTH_STATE_COOKIE_OPTIONS } from '@/lib/oauth-state'

export function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

  if (!clientId) {
    return new NextResponse('Google OAuth is not configured (missing GOOGLE_CLIENT_ID).', { status: 503 })
  }

  // Bind this flow to this browser: the callback rejects any other state (#76).
  const state = createOAuthState()
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${baseUrl}/api/auth/callback/google`,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
    state,
  })

  const response = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
  response.cookies.set(OAUTH_STATE_COOKIE, state, OAUTH_STATE_COOKIE_OPTIONS)
  return response
}
