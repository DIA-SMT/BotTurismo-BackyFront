-- Disponibilidad de bicicletas municipales por salida (Bici Tour).
-- Ejecutar una vez en el SQL Editor de Supabase.
-- La salida puede tener un stock de bicis prestadas ademas del cupo de
-- personas; el turista indica cuantas bicis municipales necesita y el
-- descuento es atomico (igual que los cupos).

ALTER TABLE tourist_departures
  ADD COLUMN IF NOT EXISTS bike_stock INT CHECK (bike_stock IS NULL OR bike_stock >= 0);

ALTER TABLE tourist_bookings
  ADD COLUMN IF NOT EXISTS municipal_bikes INT NOT NULL DEFAULT 0 CHECK (municipal_bikes >= 0);

-- Se reemplaza la funcion de reserva agregando p_municipal_bikes (default 0):
-- las llamadas viejas (sin el parametro) siguen funcionando igual.
DROP FUNCTION IF EXISTS create_tourist_booking(BIGINT, TEXT, TEXT, TEXT, TEXT, INT, TEXT);

CREATE OR REPLACE FUNCTION create_tourist_booking(
  p_departure_id BIGINT,
  p_full_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_origin_city TEXT,
  p_people_count INT,
  p_language TEXT DEFAULT 'es',
  p_municipal_bikes INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_departure tourist_departures%ROWTYPE;
  v_reserved INT;
  v_bikes_reserved INT;
  v_booking tourist_bookings%ROWTYPE;
  v_today DATE;
BEGIN
  IF p_people_count IS NULL OR p_people_count < 1 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PEOPLE_COUNT');
  END IF;

  IF p_municipal_bikes IS NULL OR p_municipal_bikes < 0 OR p_municipal_bikes > p_people_count THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_BIKES');
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

  IF p_municipal_bikes > 0 THEN
    IF v_departure.bike_stock IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'code', 'INVALID_BIKES');
    END IF;

    SELECT COALESCE(SUM(municipal_bikes), 0) INTO v_bikes_reserved
    FROM tourist_bookings
    WHERE departure_id = p_departure_id AND status = 'confirmed';

    IF v_bikes_reserved + p_municipal_bikes > v_departure.bike_stock THEN
      RETURN jsonb_build_object(
        'ok', false,
        'code', 'NO_BIKES',
        'remaining_bikes', GREATEST(v_departure.bike_stock - v_bikes_reserved, 0)
      );
    END IF;
  END IF;

  INSERT INTO tourist_bookings (departure_id, full_name, email, phone, origin_city, people_count, language, municipal_bikes)
  VALUES (
    p_departure_id,
    p_full_name,
    p_email,
    p_phone,
    NULLIF(TRIM(COALESCE(p_origin_city, '')), ''),
    p_people_count,
    COALESCE(NULLIF(p_language, ''), 'es'),
    p_municipal_bikes
  )
  RETURNING * INTO v_booking;

  RETURN jsonb_build_object(
    'ok', true,
    'booking', to_jsonb(v_booking),
    'remaining', v_departure.capacity - v_reserved - p_people_count
  );
END;
$$;
