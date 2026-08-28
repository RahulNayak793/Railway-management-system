-- Migration 04: Fix Infinite Recursion in Profiles Row Level Security (RLS) Policies
-- This migration updates the role checking function to query auth.users directly, preventing recursive RLS evaluation.

-- 1. Re-create a SECURITY DEFINER function to retrieve user role safely from auth.users (bypassing public.profiles RLS)
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT COALESCE(raw_user_meta_data->>'role', 'passenger') INTO user_role 
    FROM auth.users 
    WHERE id = user_id;
    RETURN COALESCE(user_role, 'passenger');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2. Drop existing policies on profiles that cause recursive RLS evaluation
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

-- 3. Re-create clean non-recursive policies on profiles using auth.jwt() claims as fast checks and get_user_role as fallback
CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING (
        auth.uid() = id 
        OR (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' IN ('staff', 'admin')
        OR public.get_user_role(auth.uid()) IN ('staff', 'admin')
    );

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (
        auth.uid() = id 
        OR (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin'
        OR public.get_user_role(auth.uid()) = 'admin'
    );

CREATE POLICY "Users can insert their own profile" ON public.profiles
    FOR INSERT WITH CHECK (
        auth.uid() = id 
        OR (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin'
        OR public.get_user_role(auth.uid()) = 'admin'
    );

-- 4. Create trigger to sync public.profiles role changes back to auth.users raw_user_meta_data
CREATE OR REPLACE FUNCTION public.sync_profile_role_to_auth()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.role IS DISTINCT FROM NEW.role THEN
        UPDATE auth.users 
        SET raw_user_meta_data = 
            COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', NEW.role)
        WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_role_updated ON public.profiles;
CREATE TRIGGER on_profile_role_updated
    AFTER UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.sync_profile_role_to_auth();
