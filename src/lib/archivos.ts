import { createHmac, timingSafeEqual } from 'crypto'
import { mkdir, readdir, readFile, rm, writeFile } from 'fs/promises'
import path from 'path'

// Archivos en el disco del servidor (antes, Supabase Storage). Cada bucket es
// una carpeta dentro de ARCHIVOS_DIR; en la VPS, /srv/turismo/compartido/archivos,
// que sobrevive a los despliegues.
//
// Las URLs firmadas imitan a las de Supabase para que el navegador no cambie:
// el panel sigue haciendo PUT a la URL de subida y mostrando <img> con la de
// lectura. Las atiende /api/archivos/[bucket]/[...ruta].

export const ARCHIVE_BUCKETS = {
  'tour-photo-books': { maxBytes: 15 * 1024 * 1024 },
  'educational-bus-request-files': { maxBytes: 10 * 1024 * 1024 },
} as const

export type ArchiveBucket = keyof typeof ARCHIVE_BUCKETS

export function isArchiveBucket(value: string): value is ArchiveBucket {
  return Object.prototype.hasOwnProperty.call(ARCHIVE_BUCKETS, value)
}

function archivesRoot() {
  return path.resolve(process.env.ARCHIVOS_DIR || path.join(process.cwd(), 'archivos'))
}

// Ruta absoluta del objeto, sin dejar salir del bucket (nada de "..", ni
// rutas absolutas, ni segmentos vacíos).
function resolveObjectPath(bucket: ArchiveBucket, objectPath: string) {
  const segments = objectPath.split('/')
  if (!objectPath || segments.some((segment) => !segment || segment === '.' || segment === '..' || segment.includes('\\'))) {
    throw new Error(`Ruta de archivo inválida: ${objectPath}`)
  }
  const bucketDir = path.join(archivesRoot(), bucket)
  const fullPath = path.join(bucketDir, ...segments)
  if (!fullPath.startsWith(bucketDir + path.sep)) throw new Error(`Ruta de archivo inválida: ${objectPath}`)
  return fullPath
}

// Sube un archivo. Sin upsert falla si ya existe, igual que Supabase.
export async function uploadArchive(
  bucket: ArchiveBucket,
  objectPath: string,
  bytes: Uint8Array,
  { upsert = false }: { upsert?: boolean } = {},
) {
  const fullPath = resolveObjectPath(bucket, objectPath)
  await mkdir(path.dirname(fullPath), { recursive: true })
  await writeFile(fullPath, bytes, { flag: upsert ? 'w' : 'wx' })
}

// Borra; los que ya no existen se ignoran.
export async function removeArchives(bucket: ArchiveBucket, objectPaths: string[]) {
  await Promise.all(objectPaths.map((objectPath) => rm(resolveObjectPath(bucket, objectPath), { force: true })))
}

export async function readArchive(bucket: ArchiveBucket, objectPath: string) {
  try {
    return await readFile(resolveObjectPath(bucket, objectPath))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

// Nombres de los archivos dentro de una carpeta del bucket (sin la carpeta).
export async function listArchives(bucket: ArchiveBucket, folder: string) {
  try {
    const entries = await readdir(resolveObjectPath(bucket, folder), { withFileTypes: true })
    return entries.filter((entry) => entry.isFile()).map((entry) => entry.name)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

// ── URLs firmadas ──

type SignedOperation = 'read' | 'write'

function signingSecret() {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 32) throw new Error('Missing AUTH_SECRET (mínimo 32 caracteres)')
  return secret
}

function sign(operation: SignedOperation, bucket: string, objectPath: string, expiresAtUnix: number) {
  return createHmac('sha256', signingSecret())
    .update(`archivo:${operation}:${bucket}:${objectPath}:${expiresAtUnix}`)
    .digest('base64url')
}

function signedUrl(operation: SignedOperation, bucket: ArchiveBucket, objectPath: string, expiresInSeconds: number) {
  resolveObjectPath(bucket, objectPath)
  const expiresAtUnix = Math.floor(Date.now() / 1000) + expiresInSeconds
  const encodedPath = objectPath.split('/').map(encodeURIComponent).join('/')
  const params = new URLSearchParams({ exp: String(expiresAtUnix), sig: sign(operation, bucket, objectPath, expiresAtUnix) })
  if (operation === 'write') params.set('op', 'write')
  return `/api/archivos/${bucket}/${encodedPath}?${params}`
}

// Para <img src>, links de descarga, etc. Es relativa al sitio.
export function createSignedReadUrl(bucket: ArchiveBucket, objectPath: string, expiresInSeconds: number) {
  return signedUrl('read', bucket, objectPath, expiresInSeconds)
}

// Para que el navegador suba el archivo con un PUT directo.
export function createSignedUploadUrl(bucket: ArchiveBucket, objectPath: string, expiresInSeconds = 2 * 60 * 60) {
  return signedUrl('write', bucket, objectPath, expiresInSeconds)
}

export function verifySignedUrl(
  operation: SignedOperation,
  bucket: ArchiveBucket,
  objectPath: string,
  expiresAtRaw: string | null,
  signature: string | null,
) {
  const expiresAtUnix = Number(expiresAtRaw)
  if (!signature || !Number.isInteger(expiresAtUnix) || expiresAtUnix * 1000 < Date.now()) return false
  const expected = Buffer.from(sign(operation, bucket, objectPath, expiresAtUnix))
  const received = Buffer.from(signature)
  return expected.length === received.length && timingSafeEqual(expected, received)
}

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

export function contentTypeFor(objectPath: string) {
  return CONTENT_TYPES[path.extname(objectPath).toLowerCase()] || 'application/octet-stream'
}

// Para imágenes manda el contenido y no la extensión: el panel comprime las
// fotos a JPEG antes de subirlas, pero la ruta conserva el nombre original
// (foto.png, IMG_123.heic).
export function contentTypeForFile(objectPath: string, bytes: Uint8Array) {
  const startsWith = (...signature: number[]) => signature.every((byte, index) => bytes[index] === byte)
  if (startsWith(0xff, 0xd8, 0xff)) return 'image/jpeg'
  if (startsWith(0x89, 0x50, 0x4e, 0x47)) return 'image/png'
  if (startsWith(0x52, 0x49, 0x46, 0x46) && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp'
  return contentTypeFor(objectPath)
}
