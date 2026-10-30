import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import LoginPageClient from '@/components/auth/LoginPageClient'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  // Con sesión abierta no tiene sentido el login. Se valida contra la base
  // (no sólo la firma de la cookie): si no, una sesión cerrada rebotaría
  // entre /login y /admin.
  if (await getAuthenticatedAdminFromCookies()) redirect('/admin')

  return (
    <Suspense fallback={null}>
      <LoginPageClient />
    </Suspense>
  )
}
