import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { educationalBusAttachmentBucket } from '@/lib/educational-bus-requests'
import { createServerSupabaseClient } from '@/lib/server-supabase'

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const { id } = await context.params
  const supabase = createServerSupabaseClient()
  const { data: requestData, error } = await supabase
    .from('educational_bus_requests')
    .select('attachment_path, attachment_name')
    .eq('id', Number(id))
    .single()

  if (error || !requestData?.attachment_path) {
    return NextResponse.json({ error: 'Archivo adjunto no encontrado.' }, { status: 404 })
  }

  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from(educationalBusAttachmentBucket)
    .createSignedUrl(requestData.attachment_path, 60)

  if (signedUrlError || !signedUrlData?.signedUrl) {
    return NextResponse.json({ error: 'No se pudo generar la descarga del adjunto.' }, { status: 500 })
  }

  return NextResponse.redirect(signedUrlData.signedUrl)
}
