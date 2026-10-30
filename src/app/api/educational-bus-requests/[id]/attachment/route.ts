import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { contentTypeFor, readArchive } from '@/lib/archivos'
import { getSql } from '@/lib/db'
import { educationalBusAttachmentBucket } from '@/lib/educational-bus-requests'

// Descarga con el nombre original del adjunto: filename en ASCII para
// navegadores viejos y filename* (RFC 5987) con el nombre completo en UTF-8.
function buildContentDisposition(fileName: string) {
  const asciiFileName = fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]|["\\]/g, '_')
  const encodedFileName = encodeURIComponent(fileName).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  )
  return `attachment; filename="${asciiFileName}"; filename*=UTF-8''${encodedFileName}`
}

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const { id } = await context.params
  const sql = getSql()
  const [requestData] = await sql<{ attachment_path: string; attachment_name: string }[]>`
    select attachment_path, attachment_name from educational_bus_requests where id = ${Number(id)}
  `.catch(() => [])

  if (!requestData?.attachment_path) {
    return NextResponse.json({ error: 'Archivo adjunto no encontrado.' }, { status: 404 })
  }

  // El archivo se sirve desde esta misma ruta en vez de redirigir a una URL
  // firmada: la descarga queda detrás del login del panel.
  const file = await readArchive(educationalBusAttachmentBucket, requestData.attachment_path).catch(() => null)

  if (!file) {
    return NextResponse.json({ error: 'No se pudo generar la descarga del adjunto.' }, { status: 500 })
  }

  return new NextResponse(new Uint8Array(file), {
    status: 200,
    headers: {
      'Content-Type': contentTypeFor(requestData.attachment_path),
      'Content-Disposition': buildContentDisposition(requestData.attachment_name || 'adjunto.docx'),
      'Cache-Control': 'no-store',
    },
  })
}
