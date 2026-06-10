import { PageTitle } from "@/components/shell/ComingSoon"

// User Management — becomes fully functional in issues #3-#7.
export default function UsersPage() {
  return (
    <div className="font-thai">
      <PageTitle icon="users">จัดการผู้ใช้</PageTitle>
      <div className="mt-6 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-white py-20 text-center">
        <p className="text-lg font-medium text-slate-500">หน้าจัดการผู้ใช้</p>
        <p className="text-sm text-slate-400">ตาราง ค้นหา เพิ่ม/แก้ไข/ลบ ผู้ใช้ จะถูกพัฒนาในขั้นถัดไป</p>
      </div>
    </div>
  )
}
