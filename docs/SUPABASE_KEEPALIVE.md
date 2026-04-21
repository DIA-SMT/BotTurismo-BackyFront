# Supabase Keepalive Mechanism 🛠️

Este mecanismo está compuesto de un flujo agnóstico para **prevenir pings de inactividad** de Supabase (especialmente en proyectos *Free Tier* que se pausan tras 7 días de baja actividad), sin impactar el servidor Node de tu aplicación, ni requerir `node-cron`.

## ¿Qué se implementó?
1. **Un Script Seguro:** El script `supabase_keepalive_migration.sql` genera una tabla especial aislada de la lógica del bot (`api.supabase_keepalive`) y permite invocarla a través del endpoint REST de la API genérica de tu aplicación (`public.keepalive()`).
2. **Acción Automatizada Externa:** GitHub Actions asume la responsabilidad corriendo el script `.github/workflows/supabase-keepalive.yml` cada 24hs inyectando el tráfico por API (agnosticismo puro).

## 🚀 Requisitos para Producción
En un ambiente real de GitHub para el BOT debés ir en tu repositorio a **Settings > Secrets and variables > Actions > New repository secret** y añadir:
1. `SUPABASE_PROJECT_URL`: `https://...supabase.co` 
2. `SUPABASE_ANON_KEY`: `eyJ...` (La misma que usa tu frontend/backend).

*⚠️ No es necesario (ni recomendado) poner el Service Role Key del bot para esto. La anon key basta porque las políticas RLS restringen la escritura puramente al ID artificial "1".*

## 🧪 Pruebas Manuales
Si querés probarlo de inmediato vía terminal, ejecutá el siguiente comando (remplazando las llaves):

```bash
curl -X POST "TU_URL/rest/v1/rpc/keepalive" \
     -H "apikey: TU_ANON_KEY" \
     -H "Authorization: Bearer TU_ANON_KEY" \
     -H "Content-Type: application/json"
```
**Respuesta esperada:**
```json
{"ok": true, "timestamp": "2026-04-21T12:00:00Z"}
```

## Para Desactivarlo Temporalmente
Para suspenderlo momentáneamente, basta con navegar en la pestaña "Actions" de Github > "Supabase Keepalive" > Botón derecho "Disable workflow".
