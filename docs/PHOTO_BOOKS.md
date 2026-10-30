# Books de fotos de recorridos

## Puesta en marcha

Las tablas (`photo_books`, `photo_book_photos`) ya están en la base. Las fotos
se guardan en disco, en `ARCHIVOS_DIR/tour-photo-books/<id del book>/`. En la
VPS esa ruta es `/srv/turismo/compartido/archivos`. Hacen falta en el `.env`:

- `DATABASE_URL`, `AUTH_SECRET` y `ARCHIVOS_DIR`.
- `CRON_SECRET`, con un valor aleatorio largo.

El navegador sube cada foto y su miniatura con un `PUT` a una URL firmada
(`/api/archivos/...`). Por eso nginx tiene que aceptar cuerpos de hasta 15 MB
(`client_max_body_size 20M`).

El panel administrativo queda disponible en `/admin/fotos`. Cada book genera un
enlace y un QR con acceso a `/fotos/[token]`.

Cada book admite hasta 30 fotos. Desde el panel se puede gestionar un book ya
creado para corregir título, fecha o descripción y agregar fotos faltantes sin
cambiar el enlace ni el QR existente.

Los ciudadanos no necesitan iniciar sesión. Pueden entrar desde la opción
`Galería` del encabezado o desde `/galeria`, elegir la fecha del recorrido y
abrir cualquiera de los books vigentes publicados para ese día.

## Caducidad

Los books vencen 7 días después de su creación. Todos los días, el crontab del
usuario `turismo` en la VPS llama a `/api/cron/photo-books-cleanup` (la línea
exacta está en `db/README.md`). La ruta exige:

```text
Authorization: Bearer <CRON_SECRET>
```

La limpieza borra primero las fotos del disco y después los registros
asociados.
