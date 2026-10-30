import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { getSql } from '@/lib/db'
import {
  formatDateTimeToDisplay,
  formatDateToDisplay,
  getCircuitLabel,
  getEducationalLevelLabel,
  getGradeYearLabel,
  getInstitutionTypeLabel,
  getRequestStatusLabel,
  getShiftLabel,
  parseBusinessDateParts,
  type EducationalBusRequest,
} from '@/lib/educational-bus-requests'
import { buildSimpleXlsxBuffer } from '@/lib/simple-xlsx'
import { getEducationalCircuitLabels } from '@/lib/educational-circuits-server'

export const runtime = 'nodejs'

type EducationalBusExportRequest = Omit<EducationalBusRequest, 'guides'> & {
  guides: string | null
}

function buildExportFileName(from: string, to: string) {
  const [fromYear, fromMonth, fromDay] = from.split('-')
  const [toYear, toMonth, toDay] = to.split('-')
  return `buses-educativos-aprobados-${fromDay}-${fromMonth}-${fromYear}_a_${toDay}-${toMonth}-${toYear}.xlsx`
}

function buildExportRows(requests: EducationalBusExportRequest[], circuitLabels: Record<string, string>) {
  const header = [
    'ID',
    'Fecha de creación',
    'Fecha de actualización',
    'Estado',
    'Circuito',
    'Fecha solicitada',
    'Turno',
    'Tipo de institución',
    'Institución',
    'Dirección de la escuela',
    'Cantidad de alumnos',
    'Grado/Año',
    'Nivel educativo',
    'Responsable',
    'Cargo del responsable',
    'Teléfono',
    'Email',
    'Observaciones adicionales',
    'Notas internas',
    'Guías',
  ]

  const rows = requests.map((request) => [
    String(request.id),
    formatDateTimeToDisplay(request.created_at),
    formatDateTimeToDisplay(request.updated_at),
    getRequestStatusLabel(request.status),
    getCircuitLabel(request.circuit, circuitLabels),
    formatDateToDisplay(request.requested_date),
    getShiftLabel(request.preferred_shift),
    getInstitutionTypeLabel(request.institution_type),
    request.institution_name,
    request.school_address,
    String(request.student_count),
    getGradeYearLabel(request.grade_year),
    getEducationalLevelLabel(request.grade_year),
    request.contact_name,
    request.contact_role,
    request.contact_phone,
    request.contact_email,
    request.additional_notes || '',
    request.internal_notes || '',
    request.guides || '',
  ])

  return [header, ...rows]
}

export async function GET(request: NextRequest) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const from = String(searchParams.get('from') || '').trim()
  const to = String(searchParams.get('to') || '').trim()

  if (!parseBusinessDateParts(from) || !parseBusinessDateParts(to)) {
    return NextResponse.json({ error: 'El rango de fechas es inválido.' }, { status: 400 })
  }

  if (from > to) {
    return NextResponse.json({ error: 'La fecha desde no puede ser mayor que la fecha hasta.' }, { status: 400 })
  }

  const sql = getSql()
  let data: EducationalBusExportRequest[]
  try {
    data = await sql<EducationalBusExportRequest[]>`
      select id, created_at, updated_at, status, circuit, requested_date, preferred_shift, institution_type,
        institution_name, school_address, student_count, grade_year, contact_name, contact_role, contact_phone,
        contact_email, additional_notes, internal_notes, guides
      from educational_bus_requests
      where status = 'approved'
        and requested_date >= ${from}
        and requested_date <= ${to}
      order by requested_date asc, preferred_shift asc
    `
  } catch {
    return NextResponse.json({ error: 'No se pudieron obtener las solicitudes aprobadas.' }, { status: 500 })
  }

  const circuitLabels = await getEducationalCircuitLabels()

  const workbookBuffer = buildSimpleXlsxBuffer([
    {
      name: 'Solicitudes aprobadas',
      rows: buildExportRows(data, circuitLabels),
    },
  ])

  return new NextResponse(workbookBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${buildExportFileName(from, to)}"`,
      'Cache-Control': 'no-store',
    },
  })
}
