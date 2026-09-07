-- Modalidad de los circuitos turisticos (pedido de la Direccion de Turismo,
-- 2026-09-07): al crear un circuito se elige entre Bus turistico, Guiado a pie
-- o Bicicletas, y la etiqueta se muestra en la pagina publica.
-- Ejecutar una vez en el SQL Editor de Supabase (es idempotente).

ALTER TABLE tourist_circuits
  ADD COLUMN IF NOT EXISTS modality TEXT NOT NULL DEFAULT 'bus';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tourist_circuits_modality_check'
  ) THEN
    ALTER TABLE tourist_circuits
      ADD CONSTRAINT tourist_circuits_modality_check
      CHECK (modality IN ('bus', 'walking', 'bike'));
  END IF;
END $$;

-- Circuitos ya cargados que no son en bus (slugs verificados contra la base
-- el 2026-09-07; los que falten se ajustan desde el panel con Editar).
UPDATE tourist_circuits SET modality = 'walking'
  WHERE slug IN ('historico-a-pie', 'museo-cielo-abierto', 'circuito-guiado-a-pie');
UPDATE tourist_circuits SET modality = 'bike'
  WHERE slug IN ('pedaleando-parque', 'bici-tour-en-el-parque-9-de-julio');
