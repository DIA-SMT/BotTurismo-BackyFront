import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE, readSessionToken } from '@/lib/admin-auth-core'

// Corre en Edge: sólo valida la firma y el vencimiento de la cookie. Si la
// sesión se cerró en la base (logout, cambio de clave), lo detectan el layout
// de /admin y cada ruta de /api/admin con getAuthenticatedAdminFromCookies().

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('next', request.nextUrl.pathname)
  return NextResponse.redirect(loginUrl)
}

export async function middleware(request: NextRequest) {
  const isAdminApi = request.nextUrl.pathname.startsWith('/api/admin')
  const session = await readSessionToken(request.cookies.get(ADMIN_SESSION_COOKIE)?.value)

  if (!session) {
    if (isAdminApi) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
    }
    const response = redirectToLogin(request)
    response.cookies.delete(ADMIN_SESSION_COOKIE)
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}
