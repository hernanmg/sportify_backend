-- Finanzas: player_payments (TypeORM/sync-schema corría después del deploy SQL)
CREATE TABLE IF NOT EXISTS player_payments (
    id SERIAL PRIMARY KEY,
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL,
    method VARCHAR(20) NOT NULL DEFAULT 'transfer',
    status VARCHAR(30) NOT NULL DEFAULT 'confirmed',
    notes TEXT,
    receipt_path VARCHAR(500),
    receipt_mime_type VARCHAR(100),
    recorded_by INTEGER,
    confirmed_at TIMESTAMP,
    rejection_reason TEXT,
    pending_fee_charge_ids JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_player_payments_team_user
    ON player_payments(team_id, user_id);

-- Comprobante de pago (imagen/PDF) adjunto al informar pago
ALTER TABLE player_payments
  ADD COLUMN IF NOT EXISTS receipt_path VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS receipt_mime_type VARCHAR(100) NULL;
