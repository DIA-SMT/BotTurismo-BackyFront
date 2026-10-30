#!/bin/bash
# Trae la base de Turismo desde Supabase al PostgreSQL de la VPS.
# Correr como root en la VPS, con el sitio y los bots PARADOS (si no, lo que
# se escriba en Supabase durante el volcado se pierde):
#
#   /srv/turismo/actual/db/migrar-desde-supabase.sh
#
# Necesita:
#   /root/.turismo-origen   DIRECT_URL="postgresql://..." de Supabase (una línea, chmod 600)
#   el rol "turismo" con clave (lo crea este script si no existe, y la pide).
#
# Deja:
#   /root/respaldos/turismo-<fecha>.sql        volcado original de public (no se toca)
#   /root/respaldos/turismo-<fecha>-admins.csv claves (hash bcrypt) de los admins
#   la base "turismo" con los datos, sin nada de Supabase (db/001_fuera_de_supabase.sql)
#
# Los archivos (fotos, adjuntos) se traen aparte con db/bajar-archivos.mjs.
set -euo pipefail

DB=turismo
ROL=turismo
AQUI=$(cd "$(dirname "$0")" && pwd)
PG_DUMP=/usr/lib/postgresql/17/bin/pg_dump
PSQL17=/usr/lib/postgresql/17/bin/psql
FECHA=$(date +%Y%m%d-%H%M%S)
VOLCADO=/root/respaldos/turismo-$FECHA.sql
ADMINS=/root/respaldos/turismo-$FECHA-admins.csv

[ "$(id -u)" = 0 ] || { echo "Correr como root."; exit 1; }
[ -f /root/.turismo-origen ] || { echo "Falta /root/.turismo-origen con DIRECT_URL de Supabase."; exit 1; }
set -a; . /root/.turismo-origen; set +a
[ -n "${DIRECT_URL:-}" ] || { echo "/root/.turismo-origen no define DIRECT_URL."; exit 1; }

if sudo -u turismo -H pm2 jlist 2>/dev/null | grep -q '"status":"online"'; then
  echo "Hay procesos de turismo corriendo (pm2). Paralos antes:"
  echo "  sudo -u turismo -H pm2 stop all"
  exit 1
fi

pg() { sudo -u postgres psql -v ON_ERROR_STOP=1 -q "$@"; }

echo "== 1/6 Rol y base"
if ! pg -Atc "select 1 from pg_roles where rolname = '$ROL'" | grep -q 1; then
  pg -c "create role $ROL login"
  read -s -p "Clave nueva para el rol $ROL (va en compartido/.env y backend.env): " C && echo
  printf "ALTER ROLE \"%s\" WITH PASSWORD '%s';\n" "$ROL" "$C" | pg
  unset C
fi
if pg -Atc "select 1 from pg_database where datname = '$DB'" | grep -q 1; then
  TABLAS=$(pg -d "$DB" -Atc "select count(*) from pg_tables where schemaname = 'public'")
  if [ "$TABLAS" != "0" ]; then
    echo "La base $DB ya tiene $TABLAS tablas. Para rehacerla desde cero:"
    echo "  sudo -u postgres dropdb $DB   (¡después de respaldarla!)"
    exit 1
  fi
else
  # Orden alfabético en castellano (ICU es-AR): con el C.UTF-8 por defecto
  # del servidor, "Álvarez" y "Ñandú" quedarían después de la "z" y las
  # mayúsculas antes que las minúsculas (listas de pasajeros, catálogos).
  sudo -u postgres createdb -O "$ROL" --template=template0 \
    --locale-provider=icu --icu-locale=es-AR --locale=C.UTF-8 "$DB"
fi
# pgcrypto en su propio esquema, como en Supabase: el volcado lo nombra
# extensions.gen_random_bytes(...) en los valores por defecto.
pg -d "$DB" -c "create schema if not exists extensions authorization $ROL; create extension if not exists pgcrypto with schema extensions;"
pg -d "$DB" -c "alter database $DB set search_path = public, extensions"

echo "== 2/6 Volcado de Supabase (esquema public)"
mkdir -p /root/respaldos
"$PG_DUMP" --schema=public --no-owner --no-privileges -d "$DIRECT_URL" -f "$VOLCADO"
echo "   $(du -h "$VOLCADO" | cut -f1) en $VOLCADO"

echo "== 3/6 Admins (auth.users: id, email y hash de la clave)"
install -m 600 /dev/null "$ADMINS"
"$PSQL17" -d "$DIRECT_URL" -v ON_ERROR_STOP=1 -Atc \
  "\copy (select u.id, u.email, u.encrypted_password from auth.users u join public.admin_profiles p on p.id = u.id) to stdout with csv" > "$ADMINS"
echo "   $(wc -l < "$ADMINS") admins"

echo "== 4/6 Restaurando en $DB"
# Lo mínimo de Supabase que el volcado nombra: auth.users (la FK de
# admin_profiles) y auth.role()/auth.uid() (las políticas). 001 lo desarma.
pg -d "$DB" <<SQL
SET ROLE $ROL;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY, email text, encrypted_password text);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS \$\$ SELECT NULL::uuid \$\$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS \$\$ SELECT 'service_role'::text \$\$;
SQL
# Los archivos se pasan por stdin: psql corre como postgres y no puede leer /root.
pg -d "$DB" -c "SET ROLE $ROL" -c "\copy auth.users (id, email, encrypted_password) from pstdin with csv" < "$ADMINS"

# El volcado de un PG 17 trae dos cosas que el 16 no entiende; se filtran a
# una copia y el original queda intacto.
APTO="${VOLCADO%.sql}-apto16.sql"
grep -vE '^SET transaction_timeout|^CREATE SCHEMA "?public"?;|^COMMENT ON SCHEMA "?public"? ' "$VOLCADO" > "$APTO"
{ echo "SET ROLE $ROL;"; cat "$APTO"; } | pg -d "$DB"

echo "== 5/6 Fuera de Supabase (db/001_fuera_de_supabase.sql)"
{ echo "SET ROLE $ROL;"; cat "$AQUI/001_fuera_de_supabase.sql"; } | pg -d "$DB"
pg -d "$DB" -c "SET ROLE $ROL" -c "DROP SCHEMA auth CASCADE"
SIN_CLAVE=$(pg -d "$DB" -Atc "select string_agg(email, ', ') from admin_profiles where password_hash is null")
[ -n "$SIN_CLAVE" ] && echo "   OJO, admins sin clave (tendrán que usar 'olvidé mi contraseña'): $SIN_CLAVE"

echo "== 6/6 Comparando filas (Supabase vs local)"
DIFERENCIAS=0
for T in $(pg -d "$DB" -Atc "select tablename from pg_tables where schemaname = 'public' order by 1"); do
  [ "$T" = "admin_sessions" ] && continue
  ORIGEN=$("$PSQL17" -d "$DIRECT_URL" -Atc "select count(*) from public.\"$T\"")
  LOCAL=$(pg -d "$DB" -Atc "select count(*) from public.\"$T\"")
  MARCA="ok"; [ "$ORIGEN" = "$LOCAL" ] || { MARCA="DISTINTO"; DIFERENCIAS=1; }
  printf "   %-32s %8s %8s  %s\n" "$T" "$ORIGEN" "$LOCAL" "$MARCA"
done
[ "$DIFERENCIAS" = 0 ] && echo "== Listo: todas las tablas coinciden." || { echo "== Hay diferencias: revisar antes de seguir."; exit 1; }
