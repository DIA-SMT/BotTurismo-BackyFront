import { NextRequest, NextResponse } from 'next/server'
import {
  ARCHIVE_BUCKETS,
  contentTypeForFile,
  isArchiveBucket,
  readArchive,
  uploadArchive,
  verifySignedUrl,
} from '@/lib/archivos'

export const runtime = 'nodejs'

type Context = { params: Promise<{ bucket: string; ruta: string[] }> }

async function resolveRequest(request: NextRequest, context: Context, operation: 'read' | 'write') {
  const { bucket, ruta } = await context.params
  if (!isArchiveBucket(bucket)) return null
  const objectPath = ruta.map((segment) => decodeURIComponent(segment)).join('/')
  const { searchParams } = request.nextUrl
  if (!verifySignedUrl(operation, bucket, objectPath, searchParams.get('exp'), searchParams.get('sig'))) return null
  return { bucket, objectPath }
}

// Lectura con URL firmada (createSignedReadUrl).
export async function GET(request: NextRequest, context: Context) {
  const target = await resolveRequest(request, context, 'read')
  if (!target) return NextResponse.json({ error: 'Link vencido o inválido.' }, { status: 403 })

  const file = await readArchive(target.bucket, target.objectPath)
  if (!file) return NextResponse.json({ error: 'Archivo no encontrado.' }, { status: 404 })

  return new NextResponse(new Uint8Array(file), {
    headers: {
      'Content-Type': contentTypeForFile(target.objectPath, file),
      'Content-Length': String(file.length),
      // El link vence, pero el contenido de una ruta nunca cambia.
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

// Subida directa desde el navegador con URL firmada (createSignedUploadUrl).
export async function PUT(request: NextRequest, context: Context) {
  const target = await resolveRequest(request, context, 'write')
  if (!target || request.nextUrl.searchParams.get('op') !== 'write') {
    return NextResponse.json({ error: 'Link vencido o inválido.' }, { status: 403 })
  }

  const { maxBytes } = ARCHIVE_BUCKETS[target.bucket]
  const declaredLength = Number(request.headers.get('content-length') || 0)
  if (declaredLength > maxBytes) return NextResponse.json({ error: 'El archivo es demasiado grande.' }, { status: 413 })

  const bytes = new Uint8Array(await request.arrayBuffer())
  if (bytes.length === 0) return NextResponse.json({ error: 'El archivo está vacío.' }, { status: 400 })
  if (bytes.length > maxBytes) return NextResponse.json({ error: 'El archivo es demasiado grande.' }, { status: 413 })

  try {
    await uploadArchive(target.bucket, target.objectPath, bytes)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      return NextResponse.json({ error: 'El archivo ya existe.' }, { status: 409 })
    }
    console.error('No se pudo guardar el archivo subido:', error)
    return NextResponse.json({ error: 'No se pudo guardar el archivo.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, path: target.objectPath })
}
