import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import {
  ADMIN_ACCESS_COOKIE,
  ADMIN_REFRESH_COOKIE,
  getCookieOptions,
  getSessionMaxAge,
  refreshAdminSession,
  verifyAccessToken,
} from '@/lib/admin-auth-core'

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('next', request.nextUrl.pathname)
  return NextResponse.redirect(loginUrl)
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isAdminRoute = pathname.startsWith('/admin')
  const isAdminApi = pathname.startsWith('/api/admin')
  const isLoginRoute = pathname === '/login'

  const accessToken = request.cookies.get(ADMIN_ACCESS_COOKIE)?.value
  const refreshToken = request.cookies.get(ADMIN_REFRESH_COOKIE)?.value

  let user = accessToken ? await verifyAccessToken(accessToken) : null
  let refreshedSession = null

  if (!user && refreshToken) {
    refreshedSession = await refreshAdminSession(refreshToken)
    if (refreshedSession?.access_token) {
      user = await verifyAccessToken(refreshedSession.access_token)
    }
  }

  if ((isAdminRoute || isAdminApi) && !user) {
    if (isAdminApi) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
    }
    const response = redirectToLogin(request)
    response.cookies.delete(ADMIN_ACCESS_COOKIE)
    response.cookies.delete(ADMIN_REFRESH_COOKIE)
    return response
  }

  if (isLoginRoute && user) {
    const response = NextResponse.redirect(new URL('/admin', request.url))
    if (refreshedSession) {
      response.cookies.set(ADMIN_ACCESS_COOKIE, refreshedSession.access_token, getCookieOptions(getSessionMaxAge(refreshedSession)))
      response.cookies.set(ADMIN_REFRESH_COOKIE, refreshedSession.refresh_token, getCookieOptions(60 * 60 * 24 * 30))
    }
    return response
  }

  const response = NextResponse.next()

  if (refreshedSession) {
    response.cookies.set(ADMIN_ACCESS_COOKIE, refreshedSession.access_token, getCookieOptions(getSessionMaxAge(refreshedSession)))
    response.cookies.set(ADMIN_REFRESH_COOKIE, refreshedSession.refresh_token, getCookieOptions(60 * 60 * 24 * 30))
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*', '/login'],
}
