-- ============================================================
-- Bot Turismo SMT — Schema Supabase
-- Proyecto: jpjgaouuyrembsuavheb
-- URL: https://jpjgaouuyrembsuavheb.supabase.co
-- ============================================================

-- Tabla principal de interacciones del bot (para dashboard + gobernanza)
CREATE TABLE IF NOT EXISTS tourist_interactions (
  id              BIGSERIAL PRIMARY KEY,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Identificación del turista
  chat_id         TEXT,           -- número WhatsApp del turista
  user_name       TEXT,           -- nombre en ManyChat

  -- Clasificación de la consulta
  intent          TEXT,           -- intent detectado por el AI Agent
  language        TEXT DEFAULT 'es', -- 'es' o 'en'
  query_text      TEXT,           -- texto de la consulta original
  bot_response    TEXT,           -- respuesta enviada al turista

  -- Datos de gobernanza / políticas públicas
  origen_provincia TEXT,          -- provincia/país de origen si lo mencionó
  medio_transporte TEXT,          -- cómo llegó (avión, auto, bus, etc.)
  budget          TEXT,           -- preferencia de presupuesto detectada
  has_photo       BOOLEAN DEFAULT false,

  -- Metadatos técnicos
  live_chat_url   TEXT            -- URL live chat ManyChat para operadores
);

-- Índices para el dashboard
CREATE INDEX IF NOT EXISTS idx_tourist_interactions_created_at ON tourist_interactions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tourist_interactions_intent     ON tourist_interactions (intent);
CREATE INDEX IF NOT EXISTS idx_tourist_interactions_language   ON tourist_interactions (language);
CREATE INDEX IF NOT EXISTS idx_tourist_interactions_origen     ON tourist_interactions (origen_provincia);
CREATE INDEX IF NOT EXISTS idx_tourist_interactions_chat_id    ON tourist_interactions (chat_id);

-- ============================================================
-- Vistas para el dashboard de KPIs
-- ============================================================

-- Total de consultas por intent (para ver qué piden más los turistas)
CREATE OR REPLACE VIEW kpi_consultas_por_intent AS
SELECT
  intent,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE language = 'en') AS en_ingles,
  COUNT(*) FILTER (WHERE language = 'es') AS en_espanol
FROM tourist_interactions
GROUP BY intent
ORDER BY total DESC;

-- Distribución geográfica de turistas (para políticas públicas)
CREATE OR REPLACE VIEW kpi_origen_turistas AS
SELECT
  COALESCE(origen_provincia, 'No especificado') AS origen,
  COUNT(*) AS total
FROM tourist_interactions
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY origen
ORDER BY total DESC;

-- Actividad diaria del bot (últimos 30 días)
CREATE OR REPLACE VIEW kpi_actividad_diaria AS
SELECT
  DATE(created_at AT TIME ZONE 'America/Argentina/Tucuman') AS dia,
  COUNT(*) AS total_consultas,
  COUNT(DISTINCT chat_id) AS turistas_unicos
FROM tourist_interactions
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY dia
ORDER BY dia DESC;

-- Franja horaria de mayor actividad
CREATE OR REPLACE VIEW kpi_franja_horaria AS
SELECT
  EXTRACT(HOUR FROM created_at AT TIME ZONE 'America/Argentina/Tucuman')::INT AS hora,
  COUNT(*) AS total
FROM tourist_interactions
GROUP BY hora
ORDER BY hora;

-- Turistas que usaron el servicio en inglés (internacionales)
CREATE OR REPLACE VIEW kpi_turistas_internacionales AS
SELECT
  DATE_TRUNC('month', created_at) AS mes,
  COUNT(*) FILTER (WHERE language = 'en') AS internacionales,
  COUNT(*) FILTER (WHERE language = 'es') AS hispanoparlantes,
  COUNT(*) AS total
FROM tourist_interactions
GROUP BY mes
ORDER BY mes DESC;

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================
-- Solo el service_role puede escribir. El anon_key NO tiene acceso.
ALTER TABLE tourist_interactions ENABLE ROW LEVEL SECURITY;

-- Política: solo service_role (n8n) puede insertar/leer
CREATE POLICY "service_role_full_access" ON tourist_interactions
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- Tabla de Preguntas Frecuentes (FAQs) — gestionable desde el dashboard
-- ============================================================

CREATE TABLE IF NOT EXISTS faqs (
  id              BIGSERIAL PRIMARY KEY,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Contenido
  pregunta        TEXT NOT NULL,
  respuesta       TEXT NOT NULL,

  -- Clasificación
  categoria       TEXT NOT NULL DEFAULT 'general',
  -- Valores válidos: excursiones | transporte | gastronomia | alojamiento |
  --                  atracciones | servicios | nocturna | salud | compras |
  --                  festivales | general

  -- Gestión
  activo          BOOLEAN NOT NULL DEFAULT true,
  orden           INT NOT NULL DEFAULT 0  -- para ordenar dentro de la categoría
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_faqs_categoria ON faqs (categoria);
CREATE INDEX IF NOT EXISTS idx_faqs_activo    ON faqs (activo);
CREATE INDEX IF NOT EXISTS idx_faqs_orden     ON faqs (orden);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS faqs_updated_at ON faqs;
CREATE TRIGGER faqs_updated_at
  BEFORE UPDATE ON faqs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- RLS para faqs
-- ============================================================
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;

-- Lectura pública (para el bot n8n y el dashboard)
CREATE POLICY "public_read_faqs" ON faqs
  FOR SELECT USING (true);

-- Escritura solo para service_role (dashboard usa service_role key)
CREATE POLICY "service_role_write_faqs" ON faqs
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- Nuevas vistas KPI
-- ============================================================

-- Distribución de medios de transporte usados para llegar
CREATE OR REPLACE VIEW kpi_medio_transporte AS
SELECT
  COALESCE(medio_transporte, 'No especificado') AS medio,
  COUNT(*) AS total
FROM tourist_interactions
WHERE created_at >= NOW() - INTERVAL '30 days'
  AND medio_transporte IS NOT NULL
GROUP BY medio
ORDER BY total DESC;

-- ============================================================
-- Seed: FAQs oficiales cargadas desde el documento de Turismo SMT
-- ============================================================

INSERT INTO faqs (categoria, pregunta, respuesta, orden) VALUES

-- EXCURSIONES
('excursiones', '¿Qué empresas recomiendan para excursiones?', 'El turista puede llevarse folletos de las empresas que promocionan en esta Dirección de Turismo.', 1),
('excursiones', '¿Qué distancias hay a los lugares turísticos?', 'Tafí del Valle: 107 km. El Mollar: 99 km. San Javier: 25 km. El Siambón: 54 km. Raco: 43 km.', 2),
('excursiones', '¿Qué recomendaciones hay para hacer excursiones?', 'Tener en cuenta el clima, vestimenta y zapatillas adecuadas, y el medio de transporte. Prestar atención al horario de regreso.', 3),
('excursiones', '¿Qué hay en Tafí Viejo para conocer?', 'Museo Ferroviario y la Hostería Atahualpa Yupanqui.', 4),
('excursiones', '¿En qué estado están las rutas a San Javier y los Valles en días de tormenta?', 'Consultamos a Vialidad para dar las respuestas. Podés ver el estado en: www.dpvtucuman.gob.ar', 5),
('excursiones', '¿Qué distancia hay al Museo Sanmartiniano en Burruyacú?', 'Ubicado en la ruta provincial 317, a 34.9 km al noreste. En el predio descansó el General San Martín en 1814, declarado Lugar Histórico Nacional. Funciona en una casona del siglo XIX.', 6),

-- TRANSPORTE
('transporte', '¿Cómo se abona el transporte público?', 'El interurbano acepta tarjeta crédito/débito, QR y Tarjeta SUBE. Las líneas urbanas aceptan Tarjeta SUBE.', 1),
('transporte', '¿Qué línea de transporte me lleva al Cadillal?', 'Para ir al Cadillal debés tomar la empresa Buscor.', 2),
('transporte', '¿Qué línea de transporte me lleva a San Javier y Yerba Buena?', 'Podés tomar la línea 1180 o la 102.', 3),
('transporte', '¿Qué empresa de transporte va a los Valles?', 'La empresa Aconquija.', 4),
('transporte', '¿En cuánto tiempo llego al aeropuerto desde el centro?', 'En auto llegás en 20 minutos. En horario pico calculá al menos 15 minutos más.', 5),
('transporte', '¿Dónde puedo alquilar un auto?', 'Hertz Tucumán, Mobile Rent a Car, City Rent a Car, Sinergia Rent a Car.', 6),
('transporte', '¿La ciudad es segura para el turista?', 'Sí. La ciudad cuenta con sistema de cámaras en cada esquina, monitoreo municipal y provincial, Patrulla de Protección Ciudadana y policías de la Provincia.', 7),
('transporte', '¿Cuánto es la tolerancia de alcohol en sangre para manejar en Tucumán?', 'Tolerancia CERO.', 8),
('transporte', '¿Dónde puedo estacionar con casa rodante o carpa?', 'En el Parque 9 de Julio.', 9),

-- GASTRONOMÍA
('gastronomia', '¿Dónde comer ricas empanadas?', 'En Restaurante La Leñita, El Portal y Peña El Cardón.', 1),
('gastronomia', '¿Dónde puedo comer sanguches de milanesa?', 'Los Eléctricos, Don Pepe, El Gigante, La Milanesa, La Kuky.', 2),
('gastronomia', '¿Dónde puedo comer asado?', 'La Leñita, El Parador, La Querencia, Mi Nueva Estancia.', 3),
('gastronomia', '¿Qué comidas típicas pero vegetarianas puedo comer y dónde?', 'Humitas y empanadas de queso o choclo. La Leñita, El Cardón e Il Postino ofrecen estas opciones.', 4),
('gastronomia', '¿Dónde puedo comer sushi?', 'Sushifeel, Sushi 2x1.', 5),
('gastronomia', '¿Dónde puedo comer comida árabe?', 'El Sultán, El Balón, Habibi, La Sirio.', 6),
('gastronomia', '¿Qué pizzerías hay?', 'La Pizzada, Pipa Pizzería, Pizzería Popular, Ché! Pizza, Pizzería La Local.', 7),
('gastronomia', '¿Qué comidas típicas puedo comer?', 'Empanadas, Humitas, Tamales, Locro y el Sanguche de milanesa (especialidad tucumana).', 8),
('gastronomia', '¿Qué postres típicos puedo comer?', 'Dulce de cayote, Dulce de leche, Quesillo con miel de caña, Achilata, Nueces confitadas, Colaciones, Alfeñiques, Tabletas de miel de caña o dulce de leche.', 9),
('gastronomia', '¿Qué vinos tucumanos hay?', 'Siete Vacas (Bodega Las Arcas de Tolombon), Victorino Premium (Bodega Finca La Churita), Trivarietal y Viognier (Bodega Altos la Ciénaga), Desata (Bodega Luna de Cuarzo).', 10),
('gastronomia', '¿A qué confitería puedo ir con niños?', 'Confiterías con juegos para niños: Freddo, La Forchetta, Resto Bar Americano, Juana, Vanshelatto.', 11),

-- ALOJAMIENTO
('alojamiento', '¿Dónde hay hostels?', 'A la Gurda Hostel (Maipú 490), Hostel del Centro (San Martín 218) y Tu Hostel (Mendoza 912) son los que mejor crítica tienen en la web.', 1),
('alojamiento', '¿Qué hoteles tienen cocheras?', 'Hotel Bicentenario, Hilton Garden Inn Tucumán, Hotel Solar Norte Tucumán, Hotel Tucumán Center y Hotel Ramada Plaza.', 2),

-- ATRACCIONES
('atracciones', '¿Qué actividades puedo hacer en un día?', 'Visitar museos como MIA, Casa Natal de Mercedes Sosa, Casa de la Ciudad y Casa Solar Belgraniana; la Casa de Gobierno; guiado a pie; tomar buses para el Museo a Cielo Abierto; Reloj de Flores; Lago San Miguel; Iglesias; Plaza Independencia; edificios notables como el Jockey Club y la Federación Económica.', 1),
('atracciones', '¿Qué actividades gratuitas ofrece la ciudad?', 'Visitas a museos municipales, provinciales y nacionales; guiados a pie; recorridos en bus (https://linktr.ee/busturisticosmt); espectáculos de folklore; navegar por el Lago San Miguel en "bicilagos".', 2),
('atracciones', '¿Cuáles son los horarios del Museo Nacional Casa Histórica?', 'Fuera de temporada: martes a domingo de 9 a 13 hs y de 16 a 20 hs. En temporada alta (julio): lunes a domingo de 9 a 19 hs.', 3),
('atracciones', '¿Qué día es el espectáculo de Luz y Sonido de la Casa Histórica?', 'Generalmente de jueves a domingos a las 20:30 hs.', 4),
('atracciones', '¿Cuánto cuesta el espectáculo de Luz y Sonido?', 'Entrada general: $8.000. Jubilados y estudiantes: $5.000.', 5),
('atracciones', '¿Cómo saco las entradas para el espectáculo de Luz y Sonido?', 'Por medio del QR que se encuentra en el Instagram del Museo: casahistorica.ar. No se pueden sacar de manera presencial. El espectáculo se suspende por lluvia.', 6),
('atracciones', '¿Qué hay en el Parque 9 de Julio para conocer?', 'Avenida de los Próceres, El Rosedal, Reloj Floral, Lago San Miguel, Museo de la Industria Azucarera, Hipódromo, Palacio de los Deportes, Plaza de juegos para niños, Plaza saludable y confiterías.', 7),
('atracciones', '¿Qué museos municipales se pueden visitar?', 'Casa Museo de la Ciudad, Museo de la Industria Azucarera (MIA), Casa Solar Belgraniana y Casa Natal de Mercedes Sosa. Todos gratuitos.', 8),
('atracciones', '¿Qué circuitos ofrece la Municipalidad?', 'Bus Turístico Circuito Escultórico, Histórico-Cultural, Lugares Notables, La Ciudadela, Nocturno con Obra Recordar, Religioso y Circuito Histórico a Pie. Consultar fechas y horarios en https://linktr.ee/busturisticosmt', 9),
('atracciones', '¿Qué plazas hay en la ciudad?', 'Plaza Independencia, Plaza San Martín, Plaza Belgrano, Plaza Urquiza, Plaza Fundación/Parque Avellaneda. También: Parque 9 de Julio, Parque Avellaneda, Parque Guillermina, Parque El Provincial.', 10),
('atracciones', '¿Qué puedo hacer un día de lluvia?', 'Cines: Atlas, Cinemacenter, VIA 24. Teatros: Rosita Avila, San Martín, Alberdi, Mercedes Sosa, Centro Cultural Virla, Ente Cultural. Otros: Escape Room Tucumán, Buba Park, Kalú Game Zone.', 11),

-- SERVICIOS
('servicios', '¿Dónde puedo cambiar moneda extranjera?', 'Agencia Duport (Congreso de Tucumán 160) y Maguitur (San Martín 765).', 1),
('servicios', '¿Cuenta la Dirección de Turismo con teléfono?', 'La Dirección no cuenta con teléfono. Sí tenemos WiFi y correo electrónico: ciudadhistorica@gmail.com', 2),
('servicios', '¿Qué centros comerciales puedo visitar?', 'Barrio Norte, Centro y Barrio Sur tienen muchos comercios. También: Shopping El Jardín Terminal; en Yerba Buena: Shopping Viejo, El Portal y Solar.', 3),
('servicios', '¿Qué folletos tienen para llevar?', 'Guía de bolsillo, empresas de viajes, alquiler de auto, hoteles, excursiones, etc.', 4),
('servicios', '¿Dónde comprar valijas?', 'La Sorpresa, ubicada en Muñecas 44 y 24 de Septiembre 149.', 5),
('servicios', '¿Dónde comprar artículos de cuero (mate, yerbero)?', 'En la Feria Plaza Congresales, locales frente a Casa Histórica y locales de Congreso primera cuadra.', 6),
('servicios', '¿Dónde comprar artesanías?', 'Paseo de los Congresales, Aeropuerto y Terminal de Ómnibus.', 7),
('servicios', '¿Qué kioscos 24 hs hay?', 'Mini Market 41 (Crisóstomo Alvarez 489), Oh!! Drugstore (Chacabuco 396).', 8),
('servicios', '¿A qué supermercado puedo ir?', 'Carrefour, Vea, Gómez Pardo, Aledo, Chango más.', 9),
('servicios', '¿A qué taller mecánico puedo ir?', 'Taller mecánico Cappeta S.H., Servicios mecánicos Longo, Repair services Fagioli, Taller Herrera, Taller mecánico Nazar.', 10),
('servicios', '¿Dónde hay lavaderos de autos?', 'Lavadero El Tigre (Virgen de la Merced 878), Lavacoches Premium (Mendoza 1731), Lavadero Max AutoSpa (Catamarca 167).', 11),
('servicios', '¿Dónde hay lavaderos de ropa?', 'Lave-rap Tucumán (Las Piedras 740), Lavandería Las Heras (Las Heras 61), Lavandería Catamarca (Catamarca 386).', 12),
('servicios', '¿Dónde hay estaciones de servicio?', 'YPF (Junín 400, Corrientes 400), Shell (Av. Mitre 285, Av. Mate de Luna 4089), Refinor (Av. Benjamín Aráoz 93, Lavalle 800).', 13),
('servicios', '¿En qué sitios web me entero de los eventos de la ciudad?', 'www.tucumanturismo.gob.ar/eventos, www.agendaculturalsmt.com, www.agenda.eltucumano.com, www.institucionalturismotuc.gob.ar/noticias', 14),

-- SALUD
('salud', '¿A qué guardia médica puedo ir?', 'Hospitales públicos: Centro de Salud Dr. Zenón Santillán, Hospital Ángel C. Padilla, Hospital de Niños, Hospital del Este, Maternidad. Sanatorios privados: 9 de Julio, Modelo, Pasquini, Sarmiento, Rivadavia.', 1),
('salud', '¿Qué farmacia tiene horario corrido?', 'Farmacia Catedral III – Red Farmar (24 de Septiembre 644), Farmar (24 de Septiembre 546).', 2),

-- VIDA NOCTURNA
('nocturna', '¿Qué peñas recomiendan?', 'La Escondida (Miguel Lillo 234), El Cardón (Las Heras 50), La Casa de Yamil (España 153), El Alto de la Lechuza (24 de Septiembre 1199).', 1),
('nocturna', '¿A qué cervecería puedo ir?', 'Porter Brewery, Dot Bar Tucumán, TBC Tucumán Brewing Company, Bar Irlanda.', 2),
('nocturna', '¿Dónde escuchar música en vivo?', 'Peña La 9, Peña Lo de la Paliza, Bar Rock, El Arlequín Pub, Bar Irlanda, García Pub, Hogwarts Music House, Caprice Guarida Cultural.', 3),
('nocturna', '¿A qué boliches puedo ir?', 'Yesterday Boliche Bailable, Malvada Club, La Cascada, La Boite.', 4),
('nocturna', '¿A qué boliche para mayores de 50 años puedo ir?', 'Veracruz, Qué Época Confitería Bailable.', 5),
('nocturna', '¿Qué boliches gay hay?', 'Diva, Los Juanes Q.V., Besha.', 6),
('nocturna', '¿A qué confitería con buena señal de WiFi puedo ir?', 'Sonríe Hay Café, Mondo, Bonafide, Benito Santos Café, Munna Cafetería.', 7),

-- FESTIVALES
('festivales', '¿Qué festivales hay en San Miguel de Tucumán?', 'Septiembre Musical, Festival Internacional Tucumán Jazz, Festival Confluencias.', 1),
('festivales', '¿Qué festivales hay en la provincia fuera de la capital?', 'Fiesta Nacional de la Humita, de la Verdura, del Yerbiao, del Caballo Cerreño, del Queso, del Quesillo, de la Pachamama, de la Nuez, de la Empanada, del Limón, del Sanguche de Milanesa, del Locro, de la Caña de Azúcar, Festival Monteros de la Patria, Festival Lules Canta a la Patria, Festividad de Nuestra Señora de Lourdes, Fiesta Provincial de la Chuscha, y muchos más.', 2),

-- GENERAL
('general', '¿Cuáles son las actividades gratuitas de la Municipalidad?', 'Todas las actividades que brinda la Municipalidad de San Miguel de Tucumán son totalmente gratuitas.', 1)

ON CONFLICT DO NOTHING;
-- ============================================================
-- Solicitudes educativas para bus turistico
-- ============================================================

CREATE TABLE IF NOT EXISTS educational_bus_requests (
  id                BIGSERIAL PRIMARY KEY,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  institution_name  TEXT NOT NULL,
  school_address    TEXT NOT NULL,
  contact_name      TEXT NOT NULL,
  contact_role      TEXT NOT NULL,
  contact_phone     TEXT NOT NULL,
  contact_email     TEXT NOT NULL,
  student_count     INT NOT NULL CHECK (student_count > 0),
  grade_year        TEXT NOT NULL,
  circuit           TEXT NOT NULL CHECK (circuit IN ('educativo', 'historico_cultural', 'memoria')),
  requested_date    DATE NOT NULL,
  preferred_shift   TEXT NOT NULL CHECK (preferred_shift IN ('manana', 'tarde')),
  institution_type  TEXT NOT NULL CHECK (institution_type IN ('municipal', 'provincial', 'private')),
  attachment_name   TEXT NOT NULL,
  attachment_path   TEXT NOT NULL,
  additional_notes  TEXT,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  internal_notes    TEXT
);

ALTER TABLE educational_bus_requests ADD COLUMN IF NOT EXISTS circuit TEXT;
UPDATE educational_bus_requests SET circuit = 'educativo' WHERE circuit IS NULL;
ALTER TABLE educational_bus_requests ALTER COLUMN circuit SET DEFAULT 'educativo';
ALTER TABLE educational_bus_requests ALTER COLUMN circuit SET NOT NULL;
ALTER TABLE educational_bus_requests ADD COLUMN IF NOT EXISTS attachment_name TEXT;
ALTER TABLE educational_bus_requests ADD COLUMN IF NOT EXISTS attachment_path TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'educational_bus_requests_circuit_check'
  ) THEN
    ALTER TABLE educational_bus_requests
      ADD CONSTRAINT educational_bus_requests_circuit_check
      CHECK (circuit IN ('educativo', 'historico_cultural', 'memoria'));
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'educational_bus_requests'
      AND column_name = 'attachment_name'
  ) THEN
    UPDATE educational_bus_requests
    SET attachment_name = COALESCE(attachment_name, 'pendiente.docx')
    WHERE attachment_name IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'educational_bus_requests'
      AND column_name = 'attachment_path'
  ) THEN
    UPDATE educational_bus_requests
    SET attachment_path = COALESCE(attachment_path, 'migracion/pendiente.docx')
    WHERE attachment_path IS NULL;
  END IF;
END $$;

ALTER TABLE educational_bus_requests ALTER COLUMN attachment_name SET NOT NULL;
ALTER TABLE educational_bus_requests ALTER COLUMN attachment_path SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_educational_requests_created_at ON educational_bus_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_educational_requests_status ON educational_bus_requests (status);
CREATE INDEX IF NOT EXISTS idx_educational_requests_requested_date ON educational_bus_requests (requested_date);
CREATE INDEX IF NOT EXISTS idx_educational_requests_institution_type ON educational_bus_requests (institution_type);
CREATE INDEX IF NOT EXISTS idx_educational_requests_circuit ON educational_bus_requests (circuit);
CREATE UNIQUE INDEX IF NOT EXISTS idx_educational_requests_unique_active_slot
  ON educational_bus_requests (requested_date, preferred_shift)
  WHERE status IN ('pending', 'approved');

DROP TRIGGER IF EXISTS educational_bus_requests_updated_at ON educational_bus_requests;
CREATE TRIGGER educational_bus_requests_updated_at
  BEFORE UPDATE ON educational_bus_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE educational_bus_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access_educational_bus_requests" ON educational_bus_requests
  FOR ALL
  USING (auth.role() = 'service_role');

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT
  'educational-bus-request-files',
  'educational-bus-request-files',
  false,
  10485760,
  ARRAY['application/vnd.openxmlformats-officedocument.wordprocessingml.document']
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'educational-bus-request-files'
);

-- ============================================================
-- Perfiles administrativos para auth del backoffice
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_profiles (
  id                    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                 TEXT,
  role                  TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin')),
  must_change_password  BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_profiles_role ON admin_profiles (role);
CREATE INDEX IF NOT EXISTS idx_admin_profiles_must_change_password ON admin_profiles (must_change_password);

DROP TRIGGER IF EXISTS admin_profiles_updated_at ON admin_profiles;
CREATE TRIGGER admin_profiles_updated_at
  BEFORE UPDATE ON admin_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION handle_new_admin_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.admin_profiles (id, email, role, must_change_password)
  VALUES (NEW.id, NEW.email, 'admin', true)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_admin_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_admin_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_admin_user();

ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access_admin_profiles" ON admin_profiles
  FOR ALL
  USING (auth.role() = 'service_role');
