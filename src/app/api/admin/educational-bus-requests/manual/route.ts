import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { createServerSupabaseClient } from '@/lib/server-supabase'
import {
  institutionTypeOptions,
  isPastBusinessDate,
  isValidPhone,
  parseBusinessDateParts,
  preferredShiftOptions,
} from '@/lib/educational-bus-requests'
import { getEducationalCircuitBySlug } from '@/lib/educational-circuits-server'

// Carga manual de turnos tomados por teléfono/presencial. Reemplaza al Excel:
// el turno queda aprobado y bloquea el calendario público al instante.
// A diferencia del formulario público, acá el admin manda: no exige nota
// adjunta, ni valida los días/turnos configurados (puede sobreescribirlos).
export async function POST(request: NextRequest) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
  }

  const circuit = String(body.circuit || '').trim()
  const requestedDate = String(body.requestedDate || '').trim()
  const preferredShift = String(body.preferredShift || '').trim()
  const institutionName = String(body.institutionName || '').trim()
  const contactName = String(body.contactName || '').trim()
  const contactPhone = String(body.contactPhone || '').trim()
  const contactEmail = String(body.contactEmail || '').trim()
  const schoolAddress = String(body.schoolAddress || '').trim()
  const institutionTypeRaw = String(body.institutionType || '').trim()
  const studentCountRaw = String(body.studentCount ?? '').trim()
  const notes = String(body.notes || '').trim()
  const status = body.status === 'pending' ? 'pending' : 'approved'

  const fieldErrors: Record<string, string> = {}
  if (!institutionName) fieldErrors.institutionName = 'Ingresá el nombre de la institución.'
  if (!parseBusinessDateParts(requestedDate)) {
    fieldErrors.requestedDate = 'Ingresá una fecha válida.'
  } else if (isPastBusinessDate(requestedDate)) {
    fieldErrors.requestedDate = 'La fecha no puede ser pasada.'
  }
  if (!preferredShiftOptions.some((option) => option.value === preferredShift)) {
    fieldErrors.preferredShift = 'Elegí el turno.'
  }
  if (contactPhone && !isValidPhone(contactPhone)) {
    fieldErrors.contactPhone = 'El teléfono no parece válido.'
  }
  let studentCount = 30
  if (studentCountRaw) {
    const parsed = Number(studentCountRaw)
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 200) {
      fieldErrors.studentCount = 'La cantidad de alumnos no es válida.'
    } else {
      studentCount = parsed
    }
  }

  const supabase = createServerSupabaseClient()

  let circuitSlug = 'historico_cultural'
  if (circuit) {
    try {
      const record = await getEducationalCircuitBySlug(supabase, circuit)
      if (record) circuitSlug = record.slug
      else fieldErrors.circuit = 'Ese circuito no existe en el catálogo educativo.'
    } catch {
      circuitSlug = circuit // catálogo sin migrar: se guarda tal cual
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json({ error: 'Revisá los campos del turno.', fieldErrors }, { status: 400 })
  }

  // El turno no debe pisar otro activo (misma regla que el formulario público).
  const { data: conflicting, error: conflictError } = await supabase
    .from('educational_bus_requests')
    .select('id, institution_name, status')
    .eq('requested_date', requestedDate)
    .eq('preferred_shift', preferredShift)
    .in('status', ['pending', 'approved'])
    .limit(1)
    .maybeSingle()

  if (conflictError) {
    return NextResponse.json({ error: 'No se pudo verificar la disponibilidad del turno.' }, { status: 500 })
  }

  if (conflicting) {
    return NextResponse.json(
      {
        error: `Ese turno ya está ocupado por "${conflicting.institution_name}" (${conflicting.status === 'approved' ? 'aprobada' : 'pendiente'}). Revisalo en el listado.`,
      },
      { status: 409 },
    )
  }

  const institutionType = institutionTypeOptions.some((option) => option.value === institutionTypeRaw)
    ? institutionTypeRaw
    : 'provincial'

  const { data, error } = await supabase
    .from('educational_bus_requests')
    .insert({
      institution_name: institutionName,
      school_address: schoolAddress || 'Sin dirección registrada',
      contact_name: contactName || 'Contacto telefónico',
      contact_role: 'Otro',
      contact_phone: contactPhone || '0000000000',
      contact_email: contactEmail.toLowerCase() || 'carga-manual@smt.gob.ar',
      student_count: studentCount,
      grade_year: 'carga_manual',
      circuit: circuitSlug,
      requested_date: requestedDate,
      preferred_shift: preferredShift,
      institution_type: institutionType,
      additional_notes: notes || null,
      internal_notes: `Cargado manualmente desde el panel (turno tomado por teléfono/presencial).`,
      attachment_name: 'carga-manual.docx',
      attachment_path: 'migracion/carga-manual.docx',
      status,
    })
    .select('*')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Ese turno ya está ocupado.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'No se pudo cargar el turno.' }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
