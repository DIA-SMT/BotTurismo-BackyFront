// Da de alta un admin del panel (o le resetea la clave si ya existe) con una
// clave temporal que se muestra una sola vez. Al entrar, el panel le pide
// cambiarla. Antes esto se hacía creando el usuario en Supabase Auth.
//
//   node --env-file=/srv/turismo/compartido/.env db/crear-admin.mjs persona@smt.gob.ar
import { randomInt } from 'crypto'
import bcrypt from 'bcryptjs'
import postgres from 'postgres'

const email = String(process.argv[2] || '').trim().toLowerCase()
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error('Uso: node --env-file=<.env> db/crear-admin.mjs persona@smt.gob.ar')
  process.exit(1)
}
if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL en el entorno.')
  process.exit(1)
}

// Sin caracteres que se confundan al dictarla (0/O, 1/l/I).
const ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const temporaryPassword = Array.from({ length: 14 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')
const passwordHash = await bcrypt.hash(temporaryPassword, 12)

const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} })
try {
  const [admin] = await sql`
    insert into admin_profiles (email, role, must_change_password, password_hash)
    values (${email}, 'admin', true, ${passwordHash})
    on conflict ((lower(email))) do update
      set password_hash = excluded.password_hash, must_change_password = true,
          reset_token_hash = null, reset_expires_at = null
    returning id, (xmax = 0) as created
  `
  // Una clave nueva cierra las sesiones abiertas de ese admin.
  await sql`delete from admin_sessions where admin_id = ${admin.id}`
  console.log(admin.created ? `Admin creado: ${email}` : `Clave reseteada: ${email}`)
  console.log(`Clave temporal: ${temporaryPassword}`)
  console.log('Pasásela por un canal privado; al entrar el panel le pide cambiarla.')
} finally {
  await sql.end()
}
