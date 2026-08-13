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

## 🚌 Sitio público (Next.js)

- `/`: Landing selectora — elegí entre Bus Turístico y Bus Educativo.
- `/turistico`: Circuitos para turistas y vecinos. Salidas programadas con cupos en tiempo real, reserva auto-confirmada y contenido en español e inglés (toggle ES/EN).
- `/educativo`: Solicitud de turnos institucionales para escuelas (Circuito Histórico Cultural).
- `/admin/turistico`: Panel para crear salidas (circuito + fecha + hora + cupo), ver inscriptos, cancelar reservas y exportar a Excel.

## 🛠️ Tecnologías
- **Backend:** Node.js, Express.
- **IA:** LangChain, OpenRouter (Gemini Flash & Pro).
- **Base de Datos:** Supabase (PostgreSQL).
- **Integración:** ManyChat API (WhatsApp).
