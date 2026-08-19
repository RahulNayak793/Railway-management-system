-- Migration 03: Fix Infinite Recursion in Profiles Row Level Security (RLS) Policies

-- 1. Create a SECURITY DEFINER function to retrieve user role safely without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role FROM public.profiles WHERE id = user_id;
    RETURN COALESCE(user_role, 'passenger');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2. Drop existing policies on profiles that cause recursive RLS evaluation
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Staff and Admin can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

-- 3. Re-create clean non-recursive policies on profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id OR public.get_user_role(auth.uid()) IN ('staff', 'admin'));

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id OR public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Users can insert their own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id OR public.get_user_role(auth.uid()) = 'admin');

-- 4. Update table policies to use public.get_user_role(auth.uid())

-- Stations
DROP POLICY IF EXISTS "Admin and Staff can modify stations" ON public.stations;
CREATE POLICY "Admin and Staff can modify stations" ON public.stations
    FOR ALL USING (public.get_user_role(auth.uid()) IN ('staff', 'admin'));

-- Trains
DROP POLICY IF EXISTS "Staff and Admin can modify trains" ON public.trains;
CREATE POLICY "Staff and Admin can modify trains" ON public.trains
    FOR ALL USING (public.get_user_role(auth.uid()) IN ('staff', 'admin'));

-- Routes
DROP POLICY IF EXISTS "Staff and Admin can modify routes" ON public.routes;
CREATE POLICY "Staff and Admin can modify routes" ON public.routes
    FOR ALL USING (public.get_user_role(auth.uid()) IN ('staff', 'admin'));

-- Seats
DROP POLICY IF EXISTS "Staff and Admin can modify seats" ON public.seats;
CREATE POLICY "Staff and Admin can modify seats" ON public.seats
    FOR ALL USING (public.get_user_role(auth.uid()) IN ('staff', 'admin'));

-- Bookings
DROP POLICY IF EXISTS "Staff and Admin can view all bookings" ON public.bookings;
CREATE POLICY "Staff and Admin can view all bookings" ON public.bookings
    FOR SELECT USING (auth.uid() = passenger_id OR public.get_user_role(auth.uid()) IN ('staff', 'admin'));

DROP POLICY IF EXISTS "Staff and Admin can update all bookings" ON public.bookings;
CREATE POLICY "Staff and Admin can update all bookings" ON public.bookings
    FOR UPDATE USING (public.get_user_role(auth.uid()) IN ('staff', 'admin'));

-- Seat Allocations
DROP POLICY IF EXISTS "Staff and Admin can manage all allocations" ON public.seat_allocations;
CREATE POLICY "Staff and Admin can manage all allocations" ON public.seat_allocations
    FOR ALL USING (public.get_user_role(auth.uid()) IN ('staff', 'admin'));

-- Payments
DROP POLICY IF EXISTS "Admin can view and update payments" ON public.payments;
CREATE POLICY "Admin can view and update payments" ON public.payments
    FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');

-- Support Tickets
DROP POLICY IF EXISTS "Staff and Admin can select all tickets" ON public.support_tickets;
CREATE POLICY "Staff and Admin can select all tickets" ON public.support_tickets
    FOR SELECT USING (auth.uid() = passenger_id OR public.get_user_role(auth.uid()) IN ('staff', 'admin'));

DROP POLICY IF EXISTS "Staff and Admin can update all tickets" ON public.support_tickets;
CREATE POLICY "Staff and Admin can update all tickets" ON public.support_tickets
    FOR UPDATE USING (public.get_user_role(auth.uid()) IN ('staff', 'admin'));
