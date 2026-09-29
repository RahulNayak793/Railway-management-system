-- Migration 16: Train Service Calendar & Operational Scheduling
-- Adds fields for frequency types, service validity periods, operating days, specific dates, and overnight offsets

ALTER TABLE IF EXISTS public.trains
ADD COLUMN IF NOT EXISTS frequency_type TEXT DEFAULT 'Daily',
ADD COLUMN IF NOT EXISTS service_start_date DATE,
ADD COLUMN IF NOT EXISTS service_end_date DATE,
ADD COLUMN IF NOT EXISTS operating_days JSONB DEFAULT '["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]'::jsonb,
ADD COLUMN IF NOT EXISTS specific_service_dates JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS service_status TEXT DEFAULT 'ACTIVE',
ADD COLUMN IF NOT EXISTS day_offset INTEGER DEFAULT 0;

ALTER TABLE IF EXISTS public.routes
ADD COLUMN IF NOT EXISTS frequency_type TEXT DEFAULT 'Daily',
ADD COLUMN IF NOT EXISTS service_start_date DATE,
ADD COLUMN IF NOT EXISTS service_end_date DATE,
ADD COLUMN IF NOT EXISTS operating_days JSONB DEFAULT '["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]'::jsonb,
ADD COLUMN IF NOT EXISTS specific_service_dates JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS service_status TEXT DEFAULT 'ACTIVE',
ADD COLUMN IF NOT EXISTS day_offset INTEGER DEFAULT 0;
