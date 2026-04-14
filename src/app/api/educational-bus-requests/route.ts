import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { createServerSupabaseClient } from '@/lib/server-supabase'
import {
  type EducationalBusRequest,
  type EducationalBusRequestFormData,
  isPastBusinessDate,
  toEducationalBusRequestPayload,
  validateEducationalBusRequestForm,
} from '@/lib/educational-bus-requests'

function mapPayloadToFormData(payload: Record<string, unknown>): EducationalBusRequestFormData {
  return {
    institutionName: String(payload.institutionName || ''),
    schoolAddress: String(payload.schoolAddress || ''),
    contactName: String(payload.contactName || ''),
    contactRole: String(payload.contactRole || ''),
    contactPhone: String(payload.contactPhone || ''),
    contactEmail: String(payload.contactEmail || ''),
    studentCount: String(payload.studentCount || ''),
    gradeYear: String(payload.gradeYear || ''),
    requestedDate: String(payload.requestedDate || ''),
    preferredShift: String(payload.preferredShift || '') as EducationalBusRequestFormData['preferredShift'],
    institutionType: String(payload.institutionType || '') as EducationalBusRequestFormData['institutionType'],
    additionalNotes: String(payload.additionalNotes || ''),
  }
}

export async function GET(request: NextRequest) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')?.trim()
  const status = searchParams.get('status')?.trim()
  const preferredShift = searchParams.get('preferredShift')?.trim()
  const institutionType = searchParams.get('institutionType')?.trim()
  const requestedDate = searchParams.get('requestedDate')?.trim()

  const supabase = createServerSupabaseClient()
  let query = supabase.from('educational_bus_requests').select('*').order('created_at', { ascending: false })

  if (search) query = query.or(`institution_name.ilike.%${search}%,contact_name.ilike.%${search}%`)
  if (status) query = query.eq('status', status)
  if (preferredShift) query = query.eq('preferred_shift', preferredShift)
  if (institutionType) query = query.eq('institution_type', institutionType)
  if (requestedDate) query = query.eq('requested_date', requestedDate)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'No se pudieron obtener las solicitudes.' }, { status: 500 })
  }

  return NextResponse.json({ data: (data || []) as EducationalBusRequest[] })
}

export async function POST(request: NextRequest) {
  const payload = mapPayloadToFormData(await request.json())
  const errors = validateEducationalBusRequestForm(payload)

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: 'Revisá los campos obligatorios.', fieldErrors: errors }, { status: 400 })
  }

  if (isPastBusinessDate(payload.requestedDate)) {
    return NextResponse.json(
      {
        error: 'No se permiten fechas pasadas.',
        fieldErrors: { requestedDate: 'No se permiten fechas pasadas.' },
      },
      { status: 400 },
    )
  }

  const supabase = createServerSupabaseClient()
  const { data: conflictingRequest, error: conflictError } = await supabase
    .from('educational_bus_requests')
    .select('id')
    .eq('requested_date', payload.requestedDate)
    .eq('preferred_shift', payload.preferredShift)
    .in('status', ['pending', 'approved'])
    .limit(1)
    .maybeSingle()

  if (conflictError) {
    return NextResponse.json({ error: 'No se pudo validar la disponibilidad del turno.' }, { status: 500 })
  }

  if (conflictingRequest) {
    return NextResponse.json(
      {
        error: 'Ese turno ya no está disponible. Elegí otra fecha o franja horaria.',
        fieldErrors: {
          requestedDate: 'Ese turno ya no está disponible.',
          preferredShift: 'Ese turno ya no está disponible.',
        },
      },
      { status: 409 },
    )
  }

  const { data, error } = await supabase
    .from('educational_bus_requests')
    .insert({
      ...toEducationalBusRequestPayload(payload),
      status: 'pending',
    })
    .select('*')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        {
          error: 'Ese turno ya no está disponible. Elegí otra fecha o franja horaria.',
          fieldErrors: {
            requestedDate: 'Ese turno ya no está disponible.',
            preferredShift: 'Ese turno ya no está disponible.',
          },
        },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: 'No se pudo registrar la solicitud.' }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
