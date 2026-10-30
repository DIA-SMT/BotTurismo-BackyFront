import { createHash, randomBytes } from 'crypto'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { getSql } from '@/lib/db'
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_MAX_AGE, readSessionToken, signSessionToken } from '@/lib/admin-auth-core'
import { createBookingEmailTransporter, isBookingEmailConfigured } from '@/lib/tourist-booking-email'

// Login propio del panel (antes era Supabase Auth). Las claves que venían de
// Supabase son hashes bcrypt y se validan igual; las nuevas también van en
// bcrypt. Los admins se dan de alta con scripts/crear-admin.mjs.

export interface AdminProfile {
  id: string
  email: string | null
  role: 'admin'
  must_change_password: boolean
  created_at: string
  updated_at: string
}

export interface AuthenticatedAdminUser {
  user: { id: string; email: string | null }
  profile: AdminProfile
  sessionId: string
}

const PASSWORD_COST = 12
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000

const profileColumns = (sql: ReturnType<typeof getSql>) =>
  sql`p.id, p.email, p.role, p.must_change_password, p.created_at, p.updated_at`

const normalizeEmail = (email: string) => email.trim().toLowerCase()
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

export async function getAdminProfile(userId: string) {
  const sql = getSql()
  const [profile] = await sql<AdminProfile[]>`select ${profileColumns(sql)} from admin_profiles p where p.id = ${userId}`
  return profile ?? null
}

export async function getAuthenticatedAdminFromCookies(): Promise<AuthenticatedAdminUser | null> {
  const cookieStore = await cookies()
  const session = await readSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)
  if (!session) return null

  const sql = getSql()
  const [profile] = await sql<AdminProfile[]>`
    select ${profileColumns(sql)}
    from admin_sessions s
    join admin_profiles p on p.id = s.admin_id
    where s.id = ${session.sessionId} and s.expires_at > now()
  `
  if (!profile) return null
  return { user: { id: profile.id, email: profile.email }, profile, sessionId: session.sessionId }
}

// ── Login ──

// Freno a la fuerza bruta: Supabase Auth lo hacía solo. En memoria alcanza
// (un solo proceso); un reinicio lo pone en cero, lo cual está bien.
const FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000
const MAX_FAILED_LOGINS = 8
const failedLogins = new Map<string, { count: number; firstAt: number }>()

function isThrottled(key: string) {
  const entry = failedLogins.get(key)
  if (!entry) return false
  if (Date.now() - entry.firstAt > FAILED_LOGIN_WINDOW_MS) {
    failedLogins.delete(key)
    return false
  }
  return entry.count >= MAX_FAILED_LOGINS
}

function registerFailedLogin(key: string) {
  const entry = failedLogins.get(key)
  if (!entry || Date.now() - entry.firstAt > FAILED_LOGIN_WINDOW_MS) {
    failedLogins.set(key, { count: 1, firstAt: Date.now() })
  } else {
    entry.count += 1
  }
}

export async function createAdminSession(adminId: string) {
  const sql = getSql()
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_MAX_AGE * 1000)
  const [session] = await sql<{ id: string }[]>`
    insert into admin_sessions (admin_id, expires_at) values (${adminId}, ${expiresAt}) returning id
  `
  // De paso se limpian las vencidas.
  await sql`delete from admin_sessions where expires_at < now()`
  return { token: await signSessionToken(session.id, expiresAt), maxAge: ADMIN_SESSION_MAX_AGE }
}

export async function signInAdmin(email: string, password: string, clientIp: string) {
  const normalizedEmail = normalizeEmail(email)
  const throttleKey = `${normalizedEmail}|${clientIp}`
  if (isThrottled(throttleKey)) return { ok: false as const, reason: 'throttled' as const }

  const sql = getSql()
  const [admin] = await sql<(AdminProfile & { password_hash: string | null })[]>`
    select ${profileColumns(sql)}, p.password_hash from admin_profiles p where lower(p.email) = ${normalizedEmail}
  `
  const valid = Boolean(admin?.password_hash && password && (await bcrypt.compare(password, admin.password_hash)))
  if (!admin || !valid) {
    registerFailedLogin(throttleKey)
    return { ok: false as const, reason: 'invalid' as const }
  }

  failedLogins.delete(throttleKey)
  const { password_hash: _hash, ...profile } = admin
  void _hash
  const session = await createAdminSession(admin.id)
  return { ok: true as const, profile: profile as AdminProfile, ...session }
}

export async function deleteAdminSession(sessionId: string) {
  const sql = getSql()
  await sql`delete from admin_sessions where id = ${sessionId}`
}

// ── Claves ──

export function hashPassword(password: string) {
  return bcrypt.hash(password, PASSWORD_COST)
}

// Cambia la clave y cierra las demás sesiones de ese admin (la actual, si se
// pasa, queda abierta).
export async function setAdminPassword(adminId: string, password: string, keepSessionId?: string) {
  const sql = getSql()
  const passwordHash = await hashPassword(password)
  await sql`
    update admin_profiles
    set password_hash = ${passwordHash}, must_change_password = false, reset_token_hash = null, reset_expires_at = null
    where id = ${adminId}
  `
  if (keepSessionId) {
    await sql`delete from admin_sessions where admin_id = ${adminId} and id <> ${keepSessionId}`
  } else {
    await sql`delete from admin_sessions where admin_id = ${adminId}`
  }
}

// Manda el mail con el link para elegir clave nueva. Si el email no es de un
// admin no hace nada, pero responde igual: no se revela quién tiene cuenta.
export async function requestPasswordReset(email: string, siteUrl: string) {
  if (!isBookingEmailConfigured()) return { ok: false as const, reason: 'mail_not_configured' as const }

  const sql = getSql()
  const [admin] = await sql<{ id: string; email: string }[]>`
    select id, email from admin_profiles where lower(email) = ${normalizeEmail(email)}
  `
  if (!admin) return { ok: true as const }

  const token = randomBytes(32).toString('base64url')
  await sql`
    update admin_profiles
    set reset_token_hash = ${sha256(token)}, reset_expires_at = ${new Date(Date.now() + RESET_TOKEN_TTL_MS)}
    where id = ${admin.id}
  `

  // El token va en el fragmento (#): el navegador no lo manda al servidor ni
  // queda en los logs de nginx.
  const link = `${siteUrl.replace(/\/+$/, '')}/update-password#token=${token}`
  try {
    await createBookingEmailTransporter().sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: admin.email,
      subject: 'Recuperar contraseña · Panel de Turismo SMT',
      text: [
        'Recibimos un pedido para cambiar la contraseña del panel de Turismo.',
        '',
        `Para elegir una nueva, entrá a este link (vence en una hora):`,
        link,
        '',
        'Si no lo pediste vos, ignorá este correo: tu contraseña sigue siendo la misma.',
      ].join('\n'),
      html: `<p>Recibimos un pedido para cambiar la contraseña del panel de Turismo.</p>
<p><a href="${link}">Elegir una contraseña nueva</a> (el link vence en una hora).</p>
<p>Si no lo pediste vos, ignorá este correo: tu contraseña sigue siendo la misma.</p>`,
    })
  } catch (error) {
    console.error('No se pudo enviar el mail de recuperación de clave:', error)
    return { ok: false as const, reason: 'mail_failed' as const }
  }
  return { ok: true as const }
}

export async function resetPasswordWithToken(token: string, password: string) {
  const sql = getSql()
  const [admin] = await sql<{ id: string }[]>`
    select id from admin_profiles where reset_token_hash = ${sha256(token)} and reset_expires_at > now()
  `
  if (!admin) return null
  await setAdminPassword(admin.id, password)
  return admin
}
