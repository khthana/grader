'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

function GoogleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
    </svg>
  )
}

function KeyIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" />
    </svg>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASS_UPPER = /[A-Z]/
const PASS_LOWER = /[a-z]/
const PASS_DIGIT = /[0-9]/
const PASS_SPECIAL = /[!@#$%^&*()\-_=+[\]{};:'",.<>/?\\|`~]/

const MSG_EMAIL = 'Please enter a valid email address.'
const MSG_PASS = 'Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.'
const MSG_WRONG_CREDS = 'Invalid email or password. Please try again.'
const MSG_NOT_REGISTERED = 'Your account is not registered in this system. Please contact your administrator.'
const MSG_SERVER = 'Something went wrong. Please try again later.'
const MSG_GOOGLE_FAIL = 'Google sign-in was cancelled or failed. Please try again.'

interface Errors {
  email?: string
  password?: string
  general?: string
}

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  function validate(): Errors {
    const errs: Errors = {}
    if (!email || !EMAIL_RE.test(email)) errs.email = MSG_EMAIL
    if (
      !password ||
      password.length < 8 ||
      !PASS_UPPER.test(password) ||
      !PASS_LOWER.test(password) ||
      !PASS_DIGIT.test(password) ||
      !PASS_SPECIAL.test(password)
    ) {
      errs.password = MSG_PASS
    }
    return errs
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault()

    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }

    setErrors({})
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (res.ok) {
        router.push('/')
      } else if (res.status === 401) {
        setErrors({ general: MSG_WRONG_CREDS })
      } else if (res.status === 403) {
        setErrors({ general: MSG_NOT_REGISTERED })
      } else {
        setErrors({ general: MSG_SERVER })
      }
    } catch {
      setErrors({ general: MSG_SERVER })
    } finally {
      setLoading(false)
    }
  }

  function handleGoogleLogin() {
    setGoogleLoading(true)
    // On failure (e.g. popup blocked / redirect error) show the google error.
    // The actual redirect; on cancellation the callback route should set ?error=google_cancelled
    const params = new URLSearchParams(window.location.search)
    if (params.get('error') === 'google_cancelled') {
      setErrors({ general: MSG_GOOGLE_FAIL })
      setGoogleLoading(false)
      return
    }
    window.location.href = '/api/auth/google'
  }

  const isSubmitting = loading || googleLoading

  return (
    <div className="flex min-h-screen font-thai">
      {/* ─── Left branding panel ────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[42%] bg-[#0F172A] flex-col justify-between px-16 py-10 relative overflow-hidden">
        {/* Ambient glow */}
        <div className="pointer-events-none absolute top-1/4 left-1/4 h-[400px] w-[400px] rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-900/20 via-transparent to-indigo-900/20" />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500 shadow-lg shadow-orange-500/20">
            <span className="text-sm font-bold text-white">CE</span>
          </div>
          <span className="text-base font-semibold tracking-tight text-white">CE-Grader</span>
        </div>

        {/* Hero text */}
        <div className="relative space-y-6">
          <h1 className="text-5xl font-semibold leading-[1.1] tracking-tight text-white">
            Python<br />
            <span className="text-orange-400">Programming</span><br />
            <span className="text-orange-400">Automated</span><br />
            Grader.
          </h1>
          <p className="max-w-xs text-sm leading-relaxed text-slate-400">
            ระบบตรวจและให้คะแนน Python code ของนักศึกษาอัตโนมัติ
            ส่ง code เข้ามา รัน ตรวจสอบกับ test cases และรับ feedback ทันที
          </p>
          <div className="inline-block rounded-full border border-slate-600 px-4 py-1.5 text-xs text-slate-400">
            Automated Grading
          </div>
        </div>

        {/* Footer */}
        <div className="relative">
          <p className="text-xs font-medium uppercase tracking-widest text-slate-500">CE-ENGINEERING</p>
          <p className="text-xs text-slate-600">Faculty of Engineering, KMITL 2026</p>
        </div>
      </div>

      {/* ─── Right form panel ───────────────────────────────────── */}
      <div className="flex flex-1 items-center justify-center bg-[#FAFAFB] px-6 py-12">
        <div className="w-full max-w-[400px]">

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold tracking-tight text-secondary sm:text-4xl">
              ลงชื่อเข้าใช้งาน
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              ยินดีต้อนรับสู่ระบบ CE-Grader กรุณาเข้าสู่ระบบด้วยบัญชี
              ของคุณเพื่อดำเนินการต่อ
            </p>
          </div>

          {/* General error */}
          {errors.general && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600" role="alert">
              {errors.general}
            </div>
          )}

          {/* Google button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {googleLoading ? <Spinner /> : <GoogleIcon />}
            {googleLoading ? 'กำลังเชื่อมต่อ…' : 'Login With Google'}
          </button>

          {/* Divider */}
          <div className="relative my-6 flex items-center">
            <div className="flex-1 border-t border-slate-200" />
            <span className="mx-4 text-xs text-slate-400">หรือใช้ EMAIL ของคุณ</span>
            <div className="flex-1 border-t border-slate-200" />
          </div>

          {/* Email / password form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Email */}
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-slate-500" htmlFor="email">
                Email
              </label>
              <div className="flex">
                <span className="inline-flex items-center rounded-s-xl border border-e-0 border-slate-200 bg-slate-50 px-3 text-slate-400">
                  <UserIcon />
                </span>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="engineering@kmitl.ac.th"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                  className={`block w-full min-w-0 flex-1 rounded-none rounded-e-xl border bg-slate-50 p-3 text-sm text-slate-900 placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 ${
                    errors.email ? 'border-red-300 focus:ring-red-400' : 'border-slate-200'
                  }`}
                />
              </div>
              {errors.email && (
                <p id="email-error" className="mt-1.5 text-xs text-red-600">{errors.email}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-slate-500" htmlFor="password">
                Password
              </label>
              <div className="flex" suppressHydrationWarning>
                <span className="inline-flex items-center rounded-s-xl border border-e-0 border-slate-200 bg-slate-50 px-3 text-slate-400">
                  <KeyIcon />
                </span>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={isSubmitting}
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  className={`block w-full min-w-0 flex-1 rounded-none rounded-e-xl border bg-slate-50 p-3 text-sm text-slate-900 placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 ${
                    errors.password ? 'border-red-300 focus:ring-red-400' : 'border-slate-200'
                  }`}
                />
              </div>
              {errors.password && (
                <p id="password-error" className="mt-1.5 text-xs text-red-600">{errors.password}</p>
              )}
            </div>

            {/* Forgot password (out-of-scope link) */}
            <div className="text-right">
              <span className="cursor-default text-xs text-slate-400 hover:text-secondary">
                Forgot password?
              </span>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-white shadow-sm hover:bg-primary-hover focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && <Spinner />}
              {loading ? 'กำลังเข้าสู่ระบบ…' : 'Login to your account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
