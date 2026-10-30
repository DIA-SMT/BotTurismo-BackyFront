import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { removeArchives, uploadArchive } from '@/lib/archivos'
import { getSql, pgErrorCode, rowValues, UNIQUE_VIOLATION } from '@/lib/db'
import {
  educationalBusAttachmentBucket,
  type EducationalBusRequest,
  type EducationalBusRequestFormData,
  isPastBusinessDate,
  toEducationalBusRequestPayload,
  validateEducationalBusAttachment,
  validateEducationalBusRequestForm,
} from '@/lib/educational-bus-requests'
import { getEducationalSettings } from '@/lib/educational-settings-server'
import { getEducationalCircuitBySlug } from '@/lib/educational-circuits-server'
import { mapEducationalCircuitRecord } from '@/lib/educational-circuits'
import { defaultEducationalSettings } from '@/lib/educational-bus-requests'

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

  const sql = getSql()
  let data: EducationalBusRequest[]
  try {
    data = await sql<EducationalBusRequest[]>`
      select * from educational_bus_requests
      where true
        ${search ? sql`and (institution_name ilike ${`%${search}%`} or contact_name ilike ${`%${search}%`})` : sql``}
        ${status ? sql`and status = ${status}` : sql``}
        ${preferredShift ? sql`and preferred_shift = ${preferredShift}` : sql``}
        ${institutionType ? sql`and institution_type = ${institutionType}` : sql``}
        ${requestedDate ? sql`and requested_date = ${requestedDate}` : sql``}
      order by created_at desc
    `
  } catch {
    return NextResponse.json({ error: 'No se pudieron obtener las solicitudes.' }, { status: 500 })
  }

  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const payload = mapPayloadToFormData(formData)
  const attachment = formData.get('attachment')
  const attachmentFile = attachment instanceof File ? attachment : null
  const globalSettings = await getEducationalSettings()

  if (!globalSettings.publicRequestsEnabled) {
    return NextResponse.json(
      { error: 'Las solicitudes online están momentáneamente deshabilitadas. Por consultas escribí a turismo@smt.gob.ar.' },
      { status: 403 },
    )
  }

  // La disponibilidad es por circuito (catálogo educativo). Si la tabla no
  // existe todavía, solo el circuito histórico funciona con los defaults.
  let circuitAvailability = null
  if (payload.circuit) {
    try {
      const record = await getEducationalCircuitBySlug(payload.circuit)
      if (record && record.active) {
        circuitAvailability = mapEducationalCircuitRecord(record).availability
      }
    } catch {
      if (payload.circuit === 'historico_cultural') {
        circuitAvailability = defaultEducationalSettings.availability
      }
    }
  }

  if (payload.circuit && !circuitAvailability) {
    return NextResponse.json(
      {
        error: 'El circuito elegido no está disponible.',
        fieldErrors: { circuit: 'El circuito elegido no está disponible.' },
      },
      { status: 400 },
    )
  }

  const settings = { ...globalSettings, availability: circuitAvailability || {} }
  const errors = validateEducationalBusRequestForm(payload, settings)
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

  const sql = getSql()
  let conflictingRequest: { id: number } | undefined
  try {
    ;[conflictingRequest] = await sql<{ id: number }[]>`
      select id from educational_bus_requests
      where requested_date = ${payload.requestedDate}
        and preferred_shift = ${payload.preferredShift}
        and status in ('pending', 'approved')
      limit 1
    `
  } catch {
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
  try {
    await uploadArchive(educationalBusAttachmentBucket, attachmentPath, new Uint8Array(uploadArrayBuffer), {
      upsert: false,
    })
  } catch {
    return NextResponse.json({ error: 'No se pudo subir el archivo adjunto.' }, { status: 500 })
  }

  let data: EducationalBusRequest
  try {
    ;[data] = await sql<EducationalBusRequest[]>`
      insert into educational_bus_requests ${rowValues(sql, {
        ...toEducationalBusRequestPayload(payload, {
          attachmentName: attachmentFile!.name,
          attachmentPath,
        }),
        status: 'pending',
      })}
      returning *
    `
  } catch (error) {
    await removeArchives(educationalBusAttachmentBucket, [attachmentPath]).catch((removeError) =>
      console.error('No se pudo borrar el adjunto de la solicitud rechazada', removeError),
    )

    if (pgErrorCode(error) === UNIQUE_VIOLATION) {
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
