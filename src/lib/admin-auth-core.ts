import { createClient, type Session } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const authKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!

export const ADMIN_ACCESS_COOKIE = 'smt_admin_access_token'
export const ADMIN_REFRESH_COOKIE = 'smt_admin_refresh_token'

function createAuthSupabaseClient() {
  return createClient(supabaseUrl, authKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export function getCookieOptions(maxAge?: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  }
}

export async function verifyAccessToken(accessToken: string) {
  const supabase = createAuthSupabaseClient()
  const { data, error } = await supabase.auth.getUser(accessToken)
  if (error || !data.user) return null
  return data.user
}

export async function refreshAdminSession(refreshToken: string) {
  const supabase = createAuthSupabaseClient()
  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: refreshToken,
  })
  if (error || !data.session) return null
  return data.session
}

export async function signInAdmin(email: string, password: string) {
  const supabase = createAuthSupabaseClient()
  return supabase.auth.signInWithPassword({ email, password })
}

export async function sendRecoveryEmail(email: string, redirectTo: string) {
  const supabase = createAuthSupabaseClient()
  return supabase.auth.resetPasswordForEmail(email, { redirectTo })
}

export async function updatePasswordWithRecoveryTokens(accessToken: string, refreshToken: string, password: string) {
  const supabase = createAuthSupabaseClient()
  const { error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  })
  if (sessionError) return { error: sessionError }
  return supabase.auth.updateUser({ password })
}

export function getSessionMaxAge(session: Session) {
  if (!session.expires_at) return 60 * 60
  const expiresIn = session.expires_at - Math.floor(Date.now() / 1000)
  return Math.max(expiresIn, 60)
}
