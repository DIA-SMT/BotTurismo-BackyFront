import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { createServerSupabaseClient } from '@/lib/server-supabase'
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

export const runtime = 'nodejs'

type EducationalBusExportRequest = Omit<EducationalBusRequest, 'guides'> & {
  guides: string | null
}

function isMissingGuidesColumnError(error: { code?: string; message?: string } | null) {
  if (!error) return false
  return error.code === 'PGRST204' || error.code === '42703' || error.message?.toLowerCase().includes('guides') === true
}

function buildExportFileName(from: string, to: string) {
  const [fromYear, fromMonth, fromDay] = from.split('-')
  const [toYear, toMonth, toDay] = to.split('-')
  return `buses-educativos-aprobados-${fromDay}-${fromMonth}-${fromYear}_a_${toDay}-${toMonth}-${toYear}.xlsx`
}

function buildExportRows(requests: EducationalBusExportRequest[]) {
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
    getCircuitLabel(request.circuit),
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

  const supabase = createServerSupabaseClient()
  let data: EducationalBusExportRequest[] | null = null
  let error: { code?: string; message?: string } | null = null

  const primaryQuery = await supabase
    .from('educational_bus_requests')
    .select(
      'id, created_at, updated_at, status, circuit, requested_date, preferred_shift, institution_type, institution_name, school_address, student_count, grade_year, contact_name, contact_role, contact_phone, contact_email, additional_notes, internal_notes, guides',
    )
    .eq('status', 'approved')
    .gte('requested_date', from)
    .lte('requested_date', to)
    .order('requested_date', { ascending: true })
    .order('preferred_shift', { ascending: true })

  data = (primaryQuery.data || []) as EducationalBusExportRequest[]
  error = primaryQuery.error

  if (error && isMissingGuidesColumnError(error)) {
    const fallbackQuery = await supabase
      .from('educational_bus_requests')
      .select(
        'id, created_at, updated_at, status, circuit, requested_date, preferred_shift, institution_type, institution_name, school_address, student_count, grade_year, contact_name, contact_role, contact_phone, contact_email, additional_notes, internal_notes',
      )
      .eq('status', 'approved')
      .gte('requested_date', from)
      .lte('requested_date', to)
      .order('requested_date', { ascending: true })
      .order('preferred_shift', { ascending: true })

    data = ((fallbackQuery.data || []) as Array<Omit<EducationalBusExportRequest, 'guides'>>).map((request) => ({
      ...request,
      guides: null,
    }))
    error = fallbackQuery.error
  }

  if (error) {
    return NextResponse.json({ error: 'No se pudieron obtener las solicitudes aprobadas.' }, { status: 500 })
  }

  const workbookBuffer = buildSimpleXlsxBuffer([
    {
      name: 'Solicitudes aprobadas',
      rows: buildExportRows(data || []),
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
