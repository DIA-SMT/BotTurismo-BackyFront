import { cookies } from 'next/headers'
import type { User } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/server-supabase'
import { ADMIN_ACCESS_COOKIE, verifyAccessToken } from '@/lib/admin-auth-core'

export interface AdminProfile {
  id: string
  email: string | null
  role: 'admin'
  must_change_password: boolean
  created_at: string
  updated_at: string
}

export interface AuthenticatedAdminUser {
  user: User
  profile: AdminProfile | null
}

export async function getAdminProfile(userId: string) {
  const supabase = createServerSupabaseClient()
  const { data } = await supabase.from('admin_profiles').select('*').eq('id', userId).maybeSingle()
  return data as AdminProfile | null
}

export async function getAuthenticatedAdminFromCookies() {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get(ADMIN_ACCESS_COOKIE)?.value
  if (!accessToken) return null

  const user = await verifyAccessToken(accessToken)
  if (!user) return null

  const profile = await getAdminProfile(user.id)
  return { user, profile } satisfies AuthenticatedAdminUser
}
