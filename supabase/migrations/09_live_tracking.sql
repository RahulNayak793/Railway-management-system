-- Add latitude and longitude columns to stations table if not exists
ALTER TABLE public.stations ADD COLUMN IF NOT EXISTS latitude NUMERIC(9,6);
ALTER TABLE public.stations ADD COLUMN IF NOT EXISTS longitude NUMERIC(9,6);

-- Create train_telemetry table
CREATE TABLE IF NOT EXISTS public.train_telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    train_id UUID UNIQUE NOT NULL REFERENCES public.trains(id) ON DELETE CASCADE,
    latitude NUMERIC(9,6),
    longitude NUMERIC(9,6),
    speed INTEGER DEFAULT 0 CHECK (speed >= 0),
    current_station_code TEXT REFERENCES public.stations(station_code) ON DELETE SET NULL,
    next_station_code TEXT REFERENCES public.stations(station_code) ON DELETE SET NULL,
    distance_travelled_km NUMERIC(8,2) DEFAULT 0 CHECK (distance_travelled_km >= 0),
    delay_minutes INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'NOT STARTED' CHECK (status IN ('NOT STARTED', 'LIVE', 'DELAYED', 'STOPPED', 'COMPLETED', 'DATA UNAVAILABLE')),
    delay_reason TEXT,
    platform TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_train_telemetry_train_id ON public.train_telemetry(train_id);
CREATE INDEX IF NOT EXISTS idx_train_telemetry_status ON public.train_telemetry(status);

-- Enable RLS
ALTER TABLE public.train_telemetry ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view telemetry" ON public.train_telemetry
    FOR SELECT USING (true);

CREATE POLICY "Staff and Admin can insert telemetry" ON public.train_telemetry
    FOR INSERT WITH CHECK (
        (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' IN ('staff', 'admin')
    );

CREATE POLICY "Staff and Admin can update telemetry" ON public.train_telemetry
    FOR UPDATE USING (
        (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' IN ('staff', 'admin')
    );

CREATE POLICY "Admin can delete telemetry" ON public.train_telemetry
    FOR DELETE USING (
        (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin'
    );
