-- Add service_date column to train_telemetry for journey isolation
ALTER TABLE public.train_telemetry ADD COLUMN IF NOT EXISTS service_date DATE DEFAULT CURRENT_DATE;

-- Add index on train_id and service_date
CREATE INDEX IF NOT EXISTS idx_train_telemetry_train_service_date ON public.train_telemetry(train_id, service_date);
