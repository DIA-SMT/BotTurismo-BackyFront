// Baja de Supabase Storage las fotos y adjuntos que la base todavía usa, a
// ARCHIVOS_DIR/<bucket>/<ruta>. Se corre en la VPS después de migrar la base,
// como el usuario turismo para que los archivos queden suyos:
//
//   cd /srv/turismo/actual
//   sudo -u turismo -H node --env-file=/srv/turismo/compartido/.env db/bajar-archivos.mjs
//
// Sólo baja lo que figura en la base (books vigentes y adjuntos de
// solicitudes): lo huérfano que haya quedado en el bucket no se trae. Se puede
// correr varias veces: lo que ya está en disco se saltea.
//
// Usa del .env: DATABASE_URL, ARCHIVOS_DIR, NEXT_PUBLIC_SUPABASE_URL y
// SUPABASE_SERVICE_ROLE_KEY (estas dos se pueden borrar después).
import { mkdir, stat, writeFile } from 'fs/promises'
import path from 'path'
import postgres from 'postgres'

const { DATABASE_URL, ARCHIVOS_DIR, NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: KEY } = process.env
for (const [name, value] of Object.entries({ DATABASE_URL, ARCHIVOS_DIR, NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: KEY })) {
  if (!value) {
    console.error(`Falta ${name} en el entorno.`)
    process.exit(1)
  }
}

const sql = postgres(DATABASE_URL, { max: 2, onnotice: () => {} })
const pending = []
try {
  const photos = await sql`
    select p.storage_path, p.thumb_path
    from photo_book_photos p join photo_books b on b.id = p.book_id
    where b.expires_at > now()
  `
  for (const photo of photos) {
    pending.push({ bucket: 'tour-photo-books', objectPath: photo.storage_path })
    if (photo.thumb_path) pending.push({ bucket: 'tour-photo-books', objectPath: photo.thumb_path })
  }
  const requests = await sql`
    select attachment_path from educational_bus_requests where attachment_path is not null and attachment_path <> ''
  `
  for (const request of requests) pending.push({ bucket: 'educational-bus-request-files', objectPath: request.attachment_path })
} finally {
  await sql.end()
}

const root = path.resolve(ARCHIVOS_DIR)
const result = { bajados: 0, yaEstaban: 0, noEstanEnSupabase: [], errores: [] }

async function exists(file) {
  try {
    return (await stat(file)).size > 0
  } catch {
    return false
  }
}

async function download({ bucket, objectPath }) {
  const target = path.join(root, bucket, ...objectPath.split('/'))
  if (!target.startsWith(path.join(root, bucket) + path.sep)) {
    result.errores.push(`${bucket}/${objectPath}: ruta inválida`)
    return
  }
  if (await exists(target)) {
    result.yaEstaban += 1
    return
  }

  const url = `${SUPABASE_URL}/storage/v1/object/authenticated/${bucket}/${objectPath.split('/').map(encodeURIComponent).join('/')}`
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { Authorization: `Bearer ${KEY}`, apikey: KEY } })
      if (response.status === 404 || response.status === 400) {
        result.noEstanEnSupabase.push(`${bucket}/${objectPath}`)
        return
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 160)}`)
      const bytes = new Uint8Array(await response.arrayBuffer())
      await mkdir(path.dirname(target), { recursive: true })
      await writeFile(target, bytes)
      result.bajados += 1
      return
    } catch (error) {
      if (attempt === 3) result.errores.push(`${bucket}/${objectPath}: ${error.message}`)
    }
  }
}

console.log(`${pending.length} archivos referenciados en la base.`)
const CONCURRENCY = 6
for (let start = 0; start < pending.length; start += CONCURRENCY) {
  await Promise.all(pending.slice(start, start + CONCURRENCY).map(download))
  process.stdout.write(`\r${Math.min(start + CONCURRENCY, pending.length)}/${pending.length}`)
}
console.log()
console.log(`Bajados: ${result.bajados} · ya estaban: ${result.yaEstaban}`)
if (result.noEstanEnSupabase.length) {
  console.log(`No están en Supabase (${result.noEstanEnSupabase.length}):`)
  for (const item of result.noEstanEnSupabase) console.log(`  ${item}`)
}
if (result.errores.length) {
  console.log(`Errores (${result.errores.length}), volver a correr para reintentar:`)
  for (const item of result.errores) console.log(`  ${item}`)
  process.exitCode = 1
}
