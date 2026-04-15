import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { createServerSupabaseClient } from '@/lib/server-supabase'
import {
  educationalBusAttachmentBucket,
  type EducationalBusRequest,
  type EducationalBusRequestFormData,
  isPastBusinessDate,
  toEducationalBusRequestPayload,
  validateEducationalBusAttachment,
  validateEducationalBusRequestForm,
} from '@/lib/educational-bus-requests'

function mapPayloadToFormData(payload: FormData): EducationalBusRequestFormData {
  return {
    circuit: String(payload.get('circuit') || '') as EducationalBusRequestFormData['circuit'],
    institutionName: String(payload.get('institutionName') || ''),
    institutionType: String(payload.get('institutionType') || '') as EducationalBusRequestFormData['institutionType'],
    schoolAddress: String(payload.get('schoolAddress') || ''),
    contactName: String(payload.get('contactName') || ''),
    contactRole: String(payload.get('contactRole') || ''),
    contactPhone: String(payload.get('contactPhone') || ''),
    contactEmail: String(payload.get('contactEmail') || ''),
    studentCount: String(payload.get('studentCount') || ''),
    gradeYear: String(payload.get('gradeYear') || ''),
    requestedDate: String(payload.get('requestedDate') || ''),
    preferredShift: String(payload.get('preferredShift') || '') as EducationalBusRequestFormData['preferredShift'],
    additionalNotes: String(payload.get('additionalNotes') || ''),
  }
}

function buildAttachmentPath(fileName: string) {
  const timestamp = Date.now()
  const randomSegment = Math.random().toString(36).slice(2, 10)
  const sanitizedFileName = fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
  return `requests/${timestamp}-${randomSegment}-${sanitizedFileName}`
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
  const formData = await request.formData()
  const payload = mapPayloadToFormData(formData)
  const attachment = formData.get('attachment')
  const attachmentFile = attachment instanceof File ? attachment : null
  const errors = validateEducationalBusRequestForm(payload)
  const attachmentError = validateEducationalBusAttachment(attachmentFile)

  if (attachmentError) {
    errors.attachment = attachmentError
  }

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

  const attachmentPath = buildAttachmentPath(attachmentFile!.name)
  const uploadArrayBuffer = await attachmentFile!.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from(educationalBusAttachmentBucket)
    .upload(attachmentPath, uploadArrayBuffer, {
      contentType: attachmentFile!.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json({ error: 'No se pudo subir el archivo adjunto.' }, { status: 500 })
  }

  const { data, error } = await supabase
    .from('educational_bus_requests')
    .insert({
      ...toEducationalBusRequestPayload(payload, {
        attachmentName: attachmentFile!.name,
        attachmentPath,
      }),
      status: 'pending',
    })
    .select('*')
    .single()

  if (error) {
    await supabase.storage.from(educationalBusAttachmentBucket).remove([attachmentPath])

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
