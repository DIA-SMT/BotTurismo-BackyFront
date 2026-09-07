import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { createServerSupabaseClient } from '@/lib/server-supabase'

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const { id } = await context.params
  const departureId = Number(id)
  if (!Number.isInteger(departureId)) {
    return NextResponse.json({ error: 'Salida inválida.' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('tourist_bookings')
    .select('*')
    .eq('departure_id', departureId)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'No se pudieron obtener las reservas.' }, { status: 500 })
  }

  // Historial de avisos enviados para esta salida (si la tabla todavía no
  // existe en Supabase, se devuelve vacío sin romper el listado de reservas).
  const { data: notificationLogs, error: logsError } = await supabase
    .from('tourist_notification_logs')
    .select('*')
    .eq('departure_id', departureId)
    .order('created_at', { ascending: false })

  if (logsError) {
    console.error('No se pudieron obtener los registros de avisos:', logsError.message)
  }

  return NextResponse.json({ data: data || [], notificationLogs: notificationLogs || [] })
}
