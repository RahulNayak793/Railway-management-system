-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table linked to auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'passenger' CHECK (role IN ('passenger', 'staff', 'admin')),
    full_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    document_url TEXT,
    updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Staff and Admin can view all profiles" ON public.profiles
    FOR SELECT USING (
        (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' IN ('staff', 'admin')
    );

CREATE POLICY "Admin can update all profiles" ON public.profiles
    FOR UPDATE USING (
        (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin'
    );

-- Trigger to sync auth.users to public.profiles on sign up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, role, full_name, phone, avatar_url)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'role', 'passenger'),
        COALESCE(new.raw_user_meta_data->>'full_name', ''),
        COALESCE(new.raw_user_meta_data->>'phone', ''),
        COALESCE(new.raw_user_meta_data->>'avatar_url', '')
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- Create trains table
CREATE TABLE IF NOT EXISTS public.trains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    train_number TEXT UNIQUE NOT NULL,
    train_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'on_time' CHECK (status IN ('on_time', 'delayed', 'cancelled')),
    delay_minutes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.trains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view trains" ON public.trains
    FOR SELECT USING (true);

CREATE POLICY "Staff and Admin can modify trains" ON public.trains
    FOR ALL USING (
        (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' IN ('staff', 'admin')
    );


-- Create stations table
CREATE TABLE IF NOT EXISTS public.stations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_code TEXT UNIQUE NOT NULL,
    station_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view stations" ON public.stations
    FOR SELECT USING (true);

CREATE POLICY "Admin and Staff can modify stations" ON public.stations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('staff', 'admin')
        )
    );


-- Create routes table
CREATE TABLE IF NOT EXISTS public.routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    train_id UUID REFERENCES public.trains(id) ON DELETE CASCADE,
    source_station_code TEXT REFERENCES public.stations(station_code) ON DELETE CASCADE,
    destination_station_code TEXT REFERENCES public.stations(station_code) ON DELETE CASCADE,
    departure_time TIME NOT NULL,
    arrival_time TIME NOT NULL,
    distance_km NUMERIC(6,2),
    fare_multiplier NUMERIC(4,2) DEFAULT 1.0,
    stop_sequence INTEGER DEFAULT 1
);

ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view routes" ON public.routes
    FOR SELECT USING (true);

CREATE POLICY "Staff and Admin can modify routes" ON public.routes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('staff', 'admin')
        )
    );


-- Create seats table
CREATE TABLE IF NOT EXISTS public.seats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    train_id UUID REFERENCES public.trains(id) ON DELETE CASCADE,
    coach_class TEXT NOT NULL CHECK (coach_class IN ('SL', '3A', '2A', '1A', 'GEN')),
    coach_number TEXT NOT NULL,
    seat_number INTEGER NOT NULL,
    berth_type TEXT CHECK (berth_type IN ('LB', 'MB', 'UB', 'SL', 'SU')),
    UNIQUE (train_id, coach_number, seat_number)
);

ALTER TABLE public.seats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view seats" ON public.seats
    FOR SELECT USING (true);

CREATE POLICY "Staff and Admin can modify seats" ON public.seats
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('staff', 'admin')
        )
    );


-- Create bookings table
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    passenger_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    train_id UUID REFERENCES public.trains(id) ON DELETE SET NULL,
    booking_date DATE DEFAULT CURRENT_DATE,
    travel_date DATE NOT NULL,
    pnr_number TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'rac', 'waitlist', 'cancelled')),
    total_fare NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Passengers can view their own bookings" ON public.bookings
    FOR SELECT USING (auth.uid() = passenger_id);

CREATE POLICY "Passengers can insert their own bookings" ON public.bookings
    FOR INSERT WITH CHECK (auth.uid() = passenger_id);

CREATE POLICY "Passengers can update their own bookings" ON public.bookings
    FOR UPDATE USING (auth.uid() = passenger_id);

CREATE POLICY "Staff and Admin can view all bookings" ON public.bookings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('staff', 'admin')
        )
    );

CREATE POLICY "Staff and Admin can update all bookings" ON public.bookings
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('staff', 'admin')
        )
    );


-- Create seat_allocations table
CREATE TABLE IF NOT EXISTS public.seat_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
    seat_id UUID REFERENCES public.seats(id) ON DELETE SET NULL,
    travel_date DATE NOT NULL,
    passenger_name TEXT NOT NULL,
    passenger_age INTEGER,
    passenger_gender TEXT,
    UNIQUE (seat_id, travel_date)
);

ALTER TABLE public.seat_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Passengers can view allocations for their bookings" ON public.seat_allocations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.bookings
            WHERE bookings.id = booking_id AND bookings.passenger_id = auth.uid()
        )
    );

CREATE POLICY "Passengers can insert allocations for their bookings" ON public.seat_allocations
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.bookings
            WHERE bookings.id = booking_id AND bookings.passenger_id = auth.uid()
        )
    );

CREATE POLICY "Staff and Admin can manage all allocations" ON public.seat_allocations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('staff', 'admin')
        )
    );


-- Create payments table
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
    payment_gateway_id TEXT,
    amount NUMERIC(10,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'refunded', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Passengers can view payments for their bookings" ON public.payments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.bookings
            WHERE bookings.id = booking_id AND bookings.passenger_id = auth.uid()
        )
    );

CREATE POLICY "Admin can view and update payments" ON public.payments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );


-- Create support_tickets table
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    passenger_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending', 'resolved')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Passengers can select their own tickets" ON public.support_tickets
    FOR SELECT USING (auth.uid() = passenger_id);

CREATE POLICY "Passengers can insert their own tickets" ON public.support_tickets
    FOR INSERT WITH CHECK (auth.uid() = passenger_id);

CREATE POLICY "Staff and Admin can select all tickets" ON public.support_tickets
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('staff', 'admin')
        )
    );

CREATE POLICY "Staff and Admin can update all tickets" ON public.support_tickets
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('staff', 'admin')
        )
    );


-- Create support_messages table
CREATE TABLE IF NOT EXISTS public.support_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES public.support_tickets(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    attachment_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select messages for their tickets" ON public.support_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.support_tickets
            WHERE support_tickets.id = ticket_id AND 
            (support_tickets.passenger_id = auth.uid() OR EXISTS (
                SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('staff', 'admin')
            ))
        )
    );

CREATE POLICY "Users can insert messages for their tickets" ON public.support_messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id AND
        EXISTS (
            SELECT 1 FROM public.support_tickets
            WHERE support_tickets.id = ticket_id AND 
            (support_tickets.passenger_id = auth.uid() OR EXISTS (
                SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('staff', 'admin')
            ))
        )
    );


-- Create feedback table
CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    passenger_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    train_id UUID REFERENCES public.trains(id) ON DELETE SET NULL,
    cleanliness INTEGER CHECK (cleanliness BETWEEN 1 AND 5),
    punctuality INTEGER CHECK (punctuality BETWEEN 1 AND 5),
    facilities INTEGER CHECK (facilities BETWEEN 1 AND 5),
    comfort INTEGER CHECK (comfort BETWEEN 1 AND 5),
    comments TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view feedback" ON public.feedback
    FOR SELECT USING (true);

CREATE POLICY "Passengers can insert feedback" ON public.feedback
    FOR INSERT WITH CHECK (auth.uid() = passenger_id);


-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'booking' CHECK (type IN ('booking', 'cancellation', 'delay', 'alert')),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System/Staff can insert notifications" ON public.notifications
    FOR INSERT WITH CHECK (true);
