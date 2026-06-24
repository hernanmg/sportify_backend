-- Elimina cuotas duplicadas (mismo jugador, concepto, temporada y vencimiento).
-- Conserva el cargo con menor id (el primero creado).
-- Ejecutar en Neon antes del deploy si ya hay duplicados por categorías múltiples.

DELETE FROM fee_charges fc
WHERE fc.paid_amount = 0
  AND fc.id NOT IN (
    SELECT MIN(id)
    FROM fee_charges
    GROUP BY team_id, user_id, concept, season, due_date, amount
  );

-- Evita duplicados futuros en cuotas mensuales
CREATE UNIQUE INDEX IF NOT EXISTS idx_fee_charges_unique_monthly_quota
  ON fee_charges (team_id, user_id, concept, season)
  WHERE type = 'monthly_quota';
