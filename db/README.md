# Base de datos de Turismo

La base vive en el PostgreSQL 16 de la VPS (`195.35.42.168`). Antes estaba en
Supabase; el código ya no usa supabase-js:

- **Consultas:** SQL directo con [postgres.js](https://github.com/porsager/postgres) (`src/lib/db.ts` en el sitio, `backend/src/services/db.js` en el bot).
- **Login del panel:** propio (`src/lib/admin-auth.ts`). Hashes bcrypt en `admin_profiles.password_hash` y sesiones en `admin_sessions`.
- **Fotos y adjuntos:** en disco, en `ARCHIVOS_DIR` (`src/lib/archivos.ts`). En la VPS es `/srv/turismo/compartido/archivos`.

| Base | Rol | Para qué |
|---|---|---|
| `turismo` | `turismo` | producción (sitio y bot) |
| `turismo_dev` | `turismo_dev` | desarrollo; se puede tirar y rearmar |

## Desarrollo

1. Abrí un túnel a la VPS y dejalo corriendo:
   ```bash
   ssh -N -L 5433:127.0.0.1:5432 feria-vps
   ```
2. Completá `.env.local` siguiendo `.env.example` (`DATABASE_URL` apuntando a `127.0.0.1:5433/turismo_dev`, `AUTH_SECRET`, `ARCHIVOS_DIR=./archivos`).
3. Creá tu admin. La clave temporal se muestra una sola vez:
   ```bash
   node --env-file=.env.local db/crear-admin.mjs vos@smt.gob.ar
   ```

**Rearmar `turismo_dev` desde cero**: creala con el mismo orden alfabético que producción (`createdb -O turismo_dev --template=template0 --locale-provider=icu --icu-locale=es-AR --locale=C.UTF-8 turismo_dev`) y cargá en orden los `supabase_*.sql` de la raíz y después `db/001_fuera_de_supabase.sql`. Antes hacen falta los objetos mínimos de Supabase que esos archivos nombran: el esquema `auth` con `users`, `uid()` y `role()`, el esquema `storage` con `buckets` y el esquema `api`. El script `migrar-desde-supabase.sh` los crea en su paso 4.

## Admins

```bash
# En la VPS (crea, o resetea la clave si ya existe):
cd /srv/turismo/actual
sudo -u turismo -H node --env-file=/srv/turismo/compartido/.env db/crear-admin.mjs persona@smt.gob.ar
```

"Olvidé mi contraseña" en `/login` manda un link de un solo uso que vence en una hora. Usa el SMTP del `.env` y `PUBLIC_SITE_URL`.

## Migración desde Supabase (una sola vez)

Hace falta que Supabase responda: la conexión directa a Postgres para la base y la API de Storage para los archivos.

1. **Variables.** En `/srv/turismo/compartido/.env` agregá `DATABASE_URL` (rol `turismo`, base `turismo`, `127.0.0.1:5432`), `AUTH_SECRET` (`openssl rand -base64 48`) y `ARCHIVOS_DIR=/srv/turismo/compartido/archivos`. En `backend.env` agregá la misma `DATABASE_URL`.
2. **Parar todo.** Así no se pierde lo que se escriba en Supabase durante el volcado:
   ```bash
   sudo -u turismo -H pm2 stop all
   ```
3. **La DIRECT_URL de Supabase.** Va en un archivo que solo lee root, nunca en la línea de comandos ni en un chat:
   ```bash
   install -m 600 /dev/null /root/.turismo-origen && nano /root/.turismo-origen   # DIRECT_URL="postgresql://..."
   ```
4. **Desplegar la rama con este código.** El script compila y vuelve a levantar los procesos. Hasta el paso 5 van a fallar, porque la base está vacía:
   ```bash
   /srv/turismo/desplegar.sh <rama>
   sudo -u turismo -H pm2 stop all
   ```
5. **La base.** El script deja un respaldo del volcado en `/root/respaldos`, restaura, corre `001_fuera_de_supabase.sql` y compara las filas tabla por tabla:
   ```bash
   /srv/turismo/actual/db/migrar-desde-supabase.sh
   ```
6. **Los archivos.** Baja solo lo que la base usa: books vigentes y adjuntos de solicitudes. Se puede repetir:
   ```bash
   install -d -o turismo -g turismo -m 750 /srv/turismo/compartido/archivos
   cd /srv/turismo/actual && sudo -u turismo -H node --env-file=/srv/turismo/compartido/.env db/bajar-archivos.mjs
   ```
7. **Levantar y verificar:**
   ```bash
   sudo -u turismo -H pm2 start /srv/turismo/ecosystem.config.js && sudo -u turismo -H pm2 save
   ```
   Probá el login del panel, una reserva de prueba, un book de fotos (subir y ver), el adjunto de una solicitud del educativo y un mensaje al bot.
8. **nginx.** Las fotos de los books (hasta 15 MB) se suben por `/api/archivos/...`: subí `client_max_body_size` a `20M` en `/etc/nginx/sites-available/turismo`, después `nginx -t && systemctl reload nginx`.
9. **Cron de limpieza de books.** Antes lo programaba `vercel.json`. Agregalo al crontab del usuario turismo (`crontab -u turismo -e`):
   ```cron
   15 3 * * * . /srv/turismo/compartido/.env && curl -fsS -m 120 -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3004/api/cron/photo-books-cleanup > /dev/null
   ```
10. **Respaldos.** Ahora los hacemos nosotros o no los hace nadie. Programá un `pg_dump` diario de `turismo` a `/root/respaldos` y llevá una copia fuera del servidor.

**Vuelta atrás.** Mientras no se borren `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` del `.env`, apuntá `actual` a la versión anterior (`ls -t /srv/turismo/versiones`) y hacé `pm2 reload`. Vuelve el código que usa Supabase.

**Al final**, con todo verificado:
- Borrá del `.env` las variables de Supabase y `/root/.turismo-origen`.
- Rotá las claves del proyecto de Supabase.
