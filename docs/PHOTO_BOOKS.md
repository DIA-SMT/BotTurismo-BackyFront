# Books de fotos de recorridos

## Puesta en marcha

1. Ejecutar `supabase_photo_books_migration.sql` en el SQL Editor del proyecto de Supabase.
2. Configurar en el despliegue las variables existentes de Supabase:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Crear una variable `CRON_SECRET` con un valor aleatorio largo.
4. Desplegar nuevamente la aplicación.

El panel administrativo queda disponible en `/admin/fotos`. Cada book genera un
enlace y un QR con acceso a `/fotos/[token]`.

Cada book admite hasta 30 fotos. Desde el panel se puede gestionar un book ya
creado para corregir título, fecha o descripción y agregar fotos faltantes sin
cambiar el enlace ni el QR existente.

Los ciudadanos no necesitan iniciar sesión. Pueden entrar desde la opción
`Galería` del encabezado o desde `/galeria`, elegir la fecha del recorrido y
abrir cualquiera de los books vigentes publicados para ese día.

## Caducidad

Los books vencen 7 días después de su creación. `vercel.json` programa una
limpieza diaria que llama a `/api/cron/photo-books-cleanup`. La ruta exige:

```text
Authorization: Bearer <CRON_SECRET>
```

La limpieza elimina primero los objetos del bucket privado `tour-photo-books` y
después los registros asociados. Si la aplicación se despliega fuera de Vercel,
hay que programar una llamada diaria equivalente desde el proveedor utilizado.
