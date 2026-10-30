import { NextResponse } from 'next/server'
import { deleteAdminSession, getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { ADMIN_SESSION_COOKIE, LEGACY_ADMIN_COOKIES } from '@/lib/admin-auth-core'

export async function POST() {
  const admin = await getAuthenticatedAdminFromCookies()
  if (admin) await deleteAdminSession(admin.sessionId)

  const response = NextResponse.json({ ok: true })
  response.cookies.delete(ADMIN_SESSION_COOKIE)
  for (const name of LEGACY_ADMIN_COOKIES) response.cookies.delete(name)
  return response
}
