# Bot de Turismo SMT 🏛️

Asistente virtual de San Miguel de Tucumán migrado de n8n a Node.js nativo. Integra WhatsApp (vía ManyChat), Inteligencia Artificial (OpenRouter/Gemini), Memoria Conversacional Dinámica y la Agenda Cultural Municipal.

## 🚀 Inicio Rápido

### Requisitos
- Node.js v18+
- Un proyecto en Supabase
- API Key de OpenRouter
- API Key de ManyChat

### Configuración
1. Clonar el repositorio.
2. Ir a la carpeta `backend/`.
3. Crear un archivo `.env` (guíate por `.env.example`).
4. Instalar dependencias: `npm install`.

### Ejecución (Desarrollo)
Para probar localmente con ManyChat:
1. En una terminal: `npm run dev` (Inicia el server en el puerto 3000).
2. En otra terminal: `npm run tunnel` (Crea un túnel público y te da la URL para ManyChat).

## 📂 Estructura del Proyecto

- `backend/`: Servidor Express, lógica de IA y servicios de integración.
- `dashboard/`: (Opcional) Interfaz de administración de FAQs e interacciones.
- `supabase_schema.sql`: Estructura de tablas y vistas para Supabase.
- `supabase_tourist_bus_migration.sql`: Salidas y reservas del Bus Turístico (ejecutar una vez en el SQL Editor de Supabase).
- `supabase_admin_selfservice_migration.sql`: Catálogo de circuitos editable y configuración del educativo (ejecutar una vez en el SQL Editor de Supabase).

## 🚌 Sitio público (Next.js)

- `/`: Landing selectora — elegí entre Bus Turístico y Bus Educativo.
- `/turistico`: Circuitos para turistas y vecinos. Salidas programadas con cupos en tiempo real, reserva auto-confirmada y contenido en español e inglés (toggle ES/EN).
- `/educativo`: Solicitud de turnos institucionales para escuelas (Circuito Histórico Cultural).
- `/admin/turistico`: Panel para crear salidas (individuales o recurrentes por semana), ver inscriptos, cancelar salidas con aviso por mail, exportar a Excel, y administrar el catálogo de circuitos (pestaña Circuitos: crear/editar/desactivar, cupo por defecto, traducción automática al inglés).
- `/admin/solicitudes` → botón Configuración: bloqueo temporal de reservas educativas, mínimo/máximo de alumnos y días/turnos habilitados.

### 🌐 Traducción automática de circuitos (opcional)

Al crear o editar un circuito turístico desde el panel, el contenido se traduce al inglés con IA (OpenRouter, mismo proveedor que el bot). Requiere `OPENROUTER_API_KEY` en el `.env` (y en Vercel). Sin la clave, los circuitos nuevos se muestran en español también en la versión en inglés.

```
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_TRANSLATE_MODEL=google/gemini-2.5-flash   # opcional
```

### 📧 Mail de confirmación de reservas (opcional)

Al confirmarse una reserva del bus turístico se envía un correo al turista (en su idioma, ES o EN). Requiere configurar SMTP en el `.env` (o en las variables de Vercel); si falta, la reserva funciona igual y solo se omite el correo.

```
SMTP_HOST=smtp.ejemplo.com
SMTP_PORT=587
SMTP_USER=usuario@smt.gob.ar
SMTP_PASS=xxxxxxxx
SMTP_FROM="Bus Turístico SMT <turismo@smt.gob.ar>"   # opcional, default: SMTP_USER
SMTP_SECURE=false                                     # opcional, "true" para puerto 465
SMTP_REPLY_TO=turismo@smt.gob.ar                      # opcional
```

## 🛠️ Tecnologías
- **Backend:** Node.js, Express.
- **IA:** LangChain, OpenRouter (Gemini Flash & Pro).
- **Base de Datos:** Supabase (PostgreSQL).
- **Integración:** ManyChat API (WhatsApp).
