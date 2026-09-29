-- Migration 15: IRCTC-Style Saved Passenger Profiles
-- Creates or updates saved_passengers table with complete profile preferences

CREATE TABLE IF NOT EXISTS public.saved_passengers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    age INTEGER,
    gender TEXT DEFAULT 'Male',
    irctc_user_id TEXT,
    berth_preference TEXT DEFAULT 'No Preference',
    food_preference TEXT DEFAULT 'No Preference',
    document_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all required columns exist if table was previously created with minimal schema
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='saved_passengers' AND column_name='irctc_user_id') THEN
        ALTER TABLE public.saved_passengers ADD COLUMN irctc_user_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='saved_passengers' AND column_name='food_preference') THEN
        ALTER TABLE public.saved_passengers ADD COLUMN food_preference TEXT DEFAULT 'No Preference';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='saved_passengers' AND column_name='updated_at') THEN
        ALTER TABLE public.saved_passengers ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Add index on user_id for fast user profile queries
CREATE INDEX IF NOT EXISTS idx_saved_passengers_user_id ON public.saved_passengers(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.saved_passengers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to prevent duplication
DROP POLICY IF EXISTS "Users can view their own saved passengers" ON public.saved_passengers;
DROP POLICY IF EXISTS "Users can insert their own saved passengers" ON public.saved_passengers;
DROP POLICY IF EXISTS "Users can update their own saved passengers" ON public.saved_passengers;
DROP POLICY IF EXISTS "Users can delete their own saved passengers" ON public.saved_passengers;

-- Create strict user-isolated RLS policies
CREATE POLICY "Users can view their own saved passengers" ON public.saved_passengers
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own saved passengers" ON public.saved_passengers
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own saved passengers" ON public.saved_passengers
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved passengers" ON public.saved_passengers
    FOR DELETE USING (auth.uid() = user_id);
