-- Add profile detail and preference columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS meal_preference TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS berth_preference TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wheelchair_required BOOLEAN DEFAULT FALSE;

-- Create saved_passengers table
CREATE TABLE IF NOT EXISTS public.saved_passengers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    age INTEGER,
    gender TEXT,
    berth_preference TEXT,
    document_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS) on saved_passengers
ALTER TABLE public.saved_passengers ENABLE ROW LEVEL SECURITY;

-- Create policies for saved_passengers
CREATE POLICY "Users can view their own saved passengers" ON public.saved_passengers
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own saved passengers" ON public.saved_passengers
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own saved passengers" ON public.saved_passengers
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved passengers" ON public.saved_passengers
    FOR DELETE USING (auth.uid() = user_id);
