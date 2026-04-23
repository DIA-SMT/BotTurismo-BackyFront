import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { createServerSupabaseClient } from '@/lib/server-supabase'
import { isPastBusinessDate, requestStatusOptions } from '@/lib/educational-bus-requests'

function isValidStatus(status: string) {
  return requestStatusOptions.some((option) => option.value === status)
}

function blocksAvailability(status: string) {
  return status === 'pending' || status === 'approved'
}

function isMissingGuidesColumnError(error: { code?: string; message?: string } | null) {
  if (!error) return false
  return error.code === 'PGRST204' || error.code === '42703' || error.message?.toLowerCase().includes('guides') === true
}

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const { id } = await context.params
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase.from('educational_bus_requests').select('*').eq('id', Number(id)).single()

  if (error || !data) {
    return NextResponse.json({ error: 'Solicitud no encontrada.' }, { status: 404 })
  }

  return NextResponse.json({ data })
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const { id } = await context.params
  const body = await request.json()
  const status = String(body.status || '')
  const internalNotes = typeof body.internalNotes === 'string' ? body.internalNotes.trim() : undefined
  const guides = typeof body.guides === 'string' ? body.guides.trim() : undefined

  if (status && !isValidStatus(status)) {
    return NextResponse.json({ error: 'Estado inválido.' }, { status: 400 })
  }

  const updatePayload: Record<string, string | null> = {}
  if (status) updatePayload.status = status
  if (internalNotes !== undefined) updatePayload.internal_notes = internalNotes
  if (guides !== undefined) updatePayload.guides = guides || null

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ error: 'No hay cambios para guardar.' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const { data: currentRequest, error: currentError } = await supabase
    .from('educational_bus_requests')
    .select('id, requested_date, preferred_shift, status')
    .eq('id', Number(id))
    .single()

  if (currentError || !currentRequest) {
    return NextResponse.json({ error: 'Solicitud no encontrada.' }, { status: 404 })
  }

  const nextStatus = status || currentRequest.status

  if (blocksAvailability(nextStatus)) {
    if (isPastBusinessDate(currentRequest.requested_date)) {
      return NextResponse.json(
        { error: 'No se puede activar una solicitud con fecha pasada.' },
        { status: 400 },
      )
    }

    const { data: conflictingRequest, error: conflictError } = await supabase
      .from('educational_bus_requests')
      .select('id')
      .eq('requested_date', currentRequest.requested_date)
      .eq('preferred_shift', currentRequest.preferred_shift)
      .in('status', ['pending', 'approved'])
      .neq('id', Number(id))
      .limit(1)
      .maybeSingle()

    if (conflictError) {
      return NextResponse.json({ error: 'No se pudo validar la disponibilidad del turno.' }, { status: 500 })
    }

    if (conflictingRequest) {
      return NextResponse.json(
        { error: 'Ese turno ya está ocupado por otra solicitud activa.' },
        { status: 409 },
      )
    }
  }

  let { data, error } = await supabase
    .from('educational_bus_requests')
    .update(updatePayload)
    .eq('id', Number(id))
    .select('*')
    .single()

  if (error && Object.prototype.hasOwnProperty.call(updatePayload, 'guides') && isMissingGuidesColumnError(error)) {
    const fallbackPayload = { ...updatePayload }
    delete fallbackPayload.guides

    ;({ data, error } = await supabase
      .from('educational_bus_requests')
      .update(fallbackPayload)
      .eq('id', Number(id))
      .select('*')
      .single())
  }

  if (error || !data) {
    if (error?.code === '23505') {
      return NextResponse.json(
        { error: 'Ese turno ya está ocupado por otra solicitud activa.' },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: 'No se pudo actualizar la solicitud.' }, { status: 500 })
  }

  return NextResponse.json({ data })
}
