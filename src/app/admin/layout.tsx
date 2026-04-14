import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'

export default async function AdminLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  const admin = await getAuthenticatedAdminFromCookies()

  if (!admin) {
    redirect('/login')
  }

  if (admin.profile?.must_change_password) {
    redirect('/update-password')
  }

  return (
    <div className="app-shell">
      <Sidebar currentUserEmail={admin.user.email || admin.profile?.email || ''} />
      <main className="main-content">{children}</main>
    </div>
  )
}
