import { redirect } from 'next/navigation'
import { NextRequest } from 'next/server'

export function GET(_req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

  if (!clientId) {
    return new Response('Google OAuth is not configured (missing GOOGLE_CLIENT_ID).', { status: 503 })
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${baseUrl}/api/auth/callback/google`,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
  })

  redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
}
