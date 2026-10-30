// Sesión del panel /admin: una cookie firmada (HMAC-SHA256) con el id de la
// sesión y su vencimiento. Este módulo no toca la base porque también lo usa
// middleware.ts, que corre en Edge: ahí sólo se valida la firma. Que la
// sesión siga existiendo (logout, cambio de clave) lo confirma admin-auth.ts
// contra la tabla admin_sessions.

export const ADMIN_SESSION_COOKIE = 'smt_admin_session'
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24 * 30

// Cookies de cuando el login era de Supabase: se borran al entrar y al salir.
export const LEGACY_ADMIN_COOKIES = ['smt_admin_access_token', 'smt_admin_refresh_token']

export function getCookieOptions(maxAge?: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  }
}

const encoder = new TextEncoder()

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 32) throw new Error('Missing AUTH_SECRET (mínimo 32 caracteres)')
  return secret
}

async function getSigningKey() {
  return crypto.subtle.importKey('raw', encoder.encode(getAuthSecret()), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ])
}

function toBase64Url(bytes: ArrayBuffer) {
  let binary = ''
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string) {
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

const signedPayload = (sessionId: string, expiresAtUnix: number) => `admin-session:${sessionId}.${expiresAtUnix}`

export async function signSessionToken(sessionId: string, expiresAt: Date) {
  const expiresAtUnix = Math.floor(expiresAt.getTime() / 1000)
  const signature = await crypto.subtle.sign('HMAC', await getSigningKey(), encoder.encode(signedPayload(sessionId, expiresAtUnix)))
  return `${sessionId}.${expiresAtUnix}.${toBase64Url(signature)}`
}

// Devuelve la sesión si la firma es válida y no venció; null en cualquier otro caso.
export async function readSessionToken(token: string | undefined | null) {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [sessionId, expiresAtRaw, signature] = parts
  const expiresAtUnix = Number(expiresAtRaw)
  if (!/^[0-9a-f-]{36}$/.test(sessionId) || !Number.isInteger(expiresAtUnix)) return null
  if (expiresAtUnix * 1000 <= Date.now()) return null

  try {
    const valid = await crypto.subtle.verify(
      'HMAC',
      await getSigningKey(),
      fromBase64Url(signature),
      encoder.encode(signedPayload(sessionId, expiresAtUnix)),
    )
    return valid ? { sessionId, expiresAt: new Date(expiresAtUnix * 1000) } : null
  } catch {
    return null
  }
}
