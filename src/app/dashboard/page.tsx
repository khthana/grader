// Placeholder protected page — proves the auth path end-to-end (issue #1).
// The real role-based shell + landing replace this in issue #2.
export default function DashboardPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 font-thai">
      <h1 className="text-2xl font-bold text-primary">CE-Grader</h1>
      <p className="text-secondary">คุณเข้าสู่ระบบแล้ว — หน้านี้เป็น placeholder ที่ป้องกันด้วย proxy</p>
      <form action="/api/auth/logout" method="post">
        <button
          type="submit"
          className="mt-4 rounded-md bg-primary px-4 py-2 text-white hover:bg-primary-hover"
        >
          ออกจากระบบ
        </button>
      </form>
    </main>
  )
}
