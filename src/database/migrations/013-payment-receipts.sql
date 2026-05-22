-- Comprobante de pago (imagen/PDF) adjunto al informar pago
ALTER TABLE player_payments
  ADD COLUMN IF NOT EXISTS receipt_path VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS receipt_mime_type VARCHAR(100) NULL;
