import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { getSql, pgErrorCode, rowValues, UNIQUE_VIOLATION } from '@/lib/db'
import { isPastBusinessDate, requestStatusOptions, type EducationalBusRequest } from '@/lib/educational-bus-requests'

function isValidStatus(status: string) {
  return requestStatusOptions.some((option) => option.value === status)
}

function blocksAvailability(status: string) {
  return status === 'pending' || status === 'approved'
}

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const { id } = await context.params
  const sql = getSql()
  const [data] = await sql<EducationalBusRequest[]>`
    select * from educational_bus_requests where id = ${Number(id)}
  `.catch(() => [])

  if (!data) {
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

  const sql = getSql()
  const [currentRequest] = await sql<Pick<EducationalBusRequest, 'id' | 'requested_date' | 'preferred_shift' | 'status'>[]>`
    select id, requested_date, preferred_shift, status from educational_bus_requests where id = ${Number(id)}
  `.catch(() => [])

  if (!currentRequest) {
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

    let conflictingRequest: { id: number } | undefined
    try {
      ;[conflictingRequest] = await sql<{ id: number }[]>`
        select id from educational_bus_requests
        where requested_date = ${currentRequest.requested_date}
          and preferred_shift = ${currentRequest.preferred_shift}
          and status in ('pending', 'approved')
          and id <> ${Number(id)}
        limit 1
      `
    } catch {
      return NextResponse.json({ error: 'No se pudo validar la disponibilidad del turno.' }, { status: 500 })
    }

    if (conflictingRequest) {
      return NextResponse.json(
        { error: 'Ese turno ya está ocupado por otra solicitud activa.' },
        { status: 409 },
      )
    }
  }

  let data: EducationalBusRequest | undefined
  try {
    ;[data] = await sql<EducationalBusRequest[]>`
      update educational_bus_requests set ${rowValues(sql, updatePayload)}
      where id = ${Number(id)}
      returning *
    `
  } catch (error) {
    if (pgErrorCode(error) === UNIQUE_VIOLATION) {
      return NextResponse.json(
        { error: 'Ese turno ya está ocupado por otra solicitud activa.' },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: 'No se pudo actualizar la solicitud.' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: 'No se pudo actualizar la solicitud.' }, { status: 500 })
  }

  return NextResponse.json({ data })
}
