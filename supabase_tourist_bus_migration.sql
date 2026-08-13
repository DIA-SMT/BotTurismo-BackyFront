-- Salidas programadas y reservas del Bus Turistico (publico general).
-- Ejecutar una vez en el SQL Editor de Supabase.

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Cada fila es una salida puntual que el equipo de turismo publica
-- (circuito + fecha + hora + cupo), igual que hoy cargan opciones en el Google Form.
CREATE TABLE IF NOT EXISTS tourist_departures (
  id              BIGSERIAL PRIMARY KEY,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  circuit_slug    TEXT,
  title           TEXT NOT NULL,
  departure_date  DATE NOT NULL,
  departure_time  TIME NOT NULL,
  capacity        INT NOT NULL CHECK (capacity > 0),
  meeting_point   TEXT,
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS tourist_bookings (
  id            BIGSERIAL PRIMARY KEY,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  departure_id  BIGINT NOT NULL REFERENCES tourist_departures(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL,
  email         TEXT NOT NULL,
  phone         TEXT NOT NULL,
  origin_city   TEXT,
  people_count  INT NOT NULL CHECK (people_count > 0),
  language      TEXT NOT NULL DEFAULT 'es' CHECK (language IN ('es', 'en')),
  status        TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_tourist_departures_date ON tourist_departures (departure_date, departure_time);
CREATE INDEX IF NOT EXISTS idx_tourist_departures_status ON tourist_departures (status);
CREATE INDEX IF NOT EXISTS idx_tourist_bookings_departure ON tourist_bookings (departure_id, status);
CREATE INDEX IF NOT EXISTS idx_tourist_bookings_created_at ON tourist_bookings (created_at DESC);

DROP TRIGGER IF EXISTS tourist_departures_updated_at ON tourist_departures;
CREATE TRIGGER tourist_departures_updated_at
  BEFORE UPDATE ON tourist_departures
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS tourist_bookings_updated_at ON tourist_bookings;
CREATE TRIGGER tourist_bookings_updated_at
  BEFORE UPDATE ON tourist_bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE tourist_departures ENABLE ROW LEVEL SECURITY;
ALTER TABLE tourist_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_tourist_departures" ON tourist_departures;
CREATE POLICY "service_role_full_access_tourist_departures" ON tourist_departures
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_full_access_tourist_bookings" ON tourist_bookings;
CREATE POLICY "service_role_full_access_tourist_bookings" ON tourist_bookings
  FOR ALL USING (auth.role() = 'service_role');

-- Reserva atomica: bloquea la salida, verifica cupo restante e inserta.
-- Evita sobreventa cuando dos personas reservan al mismo tiempo.
CREATE OR REPLACE FUNCTION create_tourist_booking(
  p_departure_id BIGINT,
  p_full_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_origin_city TEXT,
  p_people_count INT,
  p_language TEXT DEFAULT 'es'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_departure tourist_departures%ROWTYPE;
  v_reserved INT;
  v_booking tourist_bookings%ROWTYPE;
  v_today DATE;
BEGIN
  IF p_people_count IS NULL OR p_people_count < 1 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PEOPLE_COUNT');
  END IF;

  SELECT * INTO v_departure
  FROM tourist_departures
  WHERE id = p_departure_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  END IF;

  IF v_departure.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'CANCELLED');
  END IF;

  v_today := (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
  IF v_departure.departure_date < v_today THEN
    RETURN jsonb_build_object('ok', false, 'code', 'PAST');
  END IF;

  SELECT COALESCE(SUM(people_count), 0) INTO v_reserved
  FROM tourist_bookings
  WHERE departure_id = p_departure_id AND status = 'confirmed';

  IF v_reserved + p_people_count > v_departure.capacity THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'NO_CAPACITY',
      'remaining', GREATEST(v_departure.capacity - v_reserved, 0)
    );
  END IF;

  INSERT INTO tourist_bookings (departure_id, full_name, email, phone, origin_city, people_count, language)
  VALUES (
    p_departure_id,
    p_full_name,
    p_email,
    p_phone,
    NULLIF(TRIM(COALESCE(p_origin_city, '')), ''),
    p_people_count,
    COALESCE(NULLIF(p_language, ''), 'es')
  )
  RETURNING * INTO v_booking;

  RETURN jsonb_build_object(
    'ok', true,
    'booking', to_jsonb(v_booking),
    'remaining', v_departure.capacity - v_reserved - p_people_count
  );
END;
$$;
