-- Alter trains table to add status columns if they don't exist
ALTER TABLE trains ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'on_time';
ALTER TABLE trains ADD COLUMN IF NOT EXISTS delay_minutes INTEGER DEFAULT 0;
ALTER TABLE trains ADD COLUMN IF NOT EXISTS delay_reason VARCHAR(255);
ALTER TABLE trains ADD COLUMN IF NOT EXISTS delay_message TEXT;
ALTER TABLE trains ADD COLUMN IF NOT EXISTS scheduled_departure_time TIME;
ALTER TABLE trains ADD COLUMN IF NOT EXISTS scheduled_arrival_time TIME;
ALTER TABLE trains ADD COLUMN IF NOT EXISTS updated_departure_time TIME;
ALTER TABLE trains ADD COLUMN IF NOT EXISTS updated_arrival_time TIME;
ALTER TABLE trains ADD COLUMN IF NOT EXISTS cancellation_reason VARCHAR(255);
ALTER TABLE trains ADD COLUMN IF NOT EXISTS cancellation_message TEXT;
ALTER TABLE trains ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- Create train_status_history table
CREATE TABLE IF NOT EXISTS train_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  train_id UUID REFERENCES trains(id) ON DELETE CASCADE,
  previous_status VARCHAR(50),
  new_status VARCHAR(50),
  delay_minutes INTEGER DEFAULT 0,
  reason VARCHAR(255),
  message TEXT,
  updated_departure_time TIME,
  updated_arrival_time TIME,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_by VARCHAR(100) DEFAULT 'ADMIN'
);
