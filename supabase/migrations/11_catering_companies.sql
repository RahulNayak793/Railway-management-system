-- Migration 11: Catering Companies & Multi-Vendor Authorization Schema

-- 1. Create catering_companies table
CREATE TABLE IF NOT EXISTS public.catering_companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT NOT NULL,
    legal_name TEXT NOT NULL,
    contact_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    fssai_number TEXT UNIQUE NOT NULL,
    address TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'AUTHORIZED', 'SUSPENDED', 'REVOKED', 'EXPIRED')),
    authorized_by UUID REFERENCES public.profiles(id),
    authorized_at TIMESTAMPTZ,
    authorization_start TIMESTAMPTZ DEFAULT NOW(),
    authorization_end TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 year'),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create company_stations junction table
CREATE TABLE IF NOT EXISTS public.company_stations (
    company_id UUID NOT NULL REFERENCES public.catering_companies(id) ON DELETE CASCADE,
    station_code TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (company_id, station_code)
);

-- Index for station lookup
CREATE INDEX IF NOT EXISTS idx_company_stations_code ON public.company_stations(station_code);

-- 3. Add catering_company_id to profiles for vendor staff users
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS catering_company_id UUID REFERENCES public.catering_companies(id) ON DELETE SET NULL;

-- 4. Create catering_menu table (if not exists) or alter columns
CREATE TABLE IF NOT EXISTS public.catering_menu (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.catering_companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'Main Course',
    type TEXT NOT NULL DEFAULT 'veg' CHECK (type IN ('veg', 'non-veg', 'jain', 'diabetic', 'child')),
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    image_url TEXT,
    is_available BOOLEAN DEFAULT true,
    prep_time_mins INTEGER DEFAULT 20,
    in_stock BOOLEAN DEFAULT true,
    rating NUMERIC(3, 2) DEFAULT 4.8,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for company menu lookup
CREATE INDEX IF NOT EXISTS idx_catering_menu_company ON public.catering_menu(company_id);

-- 5. Create catering_orders table
CREATE TABLE IF NOT EXISTS public.catering_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT UNIQUE NOT NULL,
    txn_id TEXT UNIQUE NOT NULL,
    company_id UUID NOT NULL REFERENCES public.catering_companies(id),
    passenger_id UUID REFERENCES public.profiles(id),
    pnr_number TEXT NOT NULL,
    train_id TEXT NOT NULL,
    train_number TEXT NOT NULL,
    train_name TEXT,
    delivery_station_code TEXT NOT NULL,
    delivery_station_name TEXT,
    journey_date DATE NOT NULL,
    coach_number TEXT NOT NULL,
    seat_number TEXT NOT NULL,
    passenger_name TEXT NOT NULL,
    items JSONB NOT NULL,
    total_amount NUMERIC(10, 2) NOT NULL,
    payment_method TEXT DEFAULT 'UPI',
    payment_status TEXT DEFAULT 'Paid',
    status TEXT NOT NULL DEFAULT 'PLACED' CHECK (status IN ('PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED')),
    delivery_status TEXT DEFAULT 'Kitchen Preparing Meal 👨‍🍳',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_catering_orders_company ON public.catering_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_catering_orders_pnr ON public.catering_orders(pnr_number);
CREATE INDEX IF NOT EXISTS idx_catering_orders_passenger ON public.catering_orders(passenger_id);

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.catering_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catering_menu ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catering_orders ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies

-- Catering Companies Policies
CREATE POLICY "Public can view authorized companies" ON public.catering_companies
    FOR SELECT USING (status = 'AUTHORIZED');

CREATE POLICY "Admin can full access catering companies" ON public.catering_companies
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Company user can view own company" ON public.catering_companies
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND catering_company_id = public.catering_companies.id
        )
    );

-- Company Stations Policies
CREATE POLICY "Public can view company station mappings" ON public.company_stations
    FOR SELECT USING (true);

CREATE POLICY "Admin can manage company stations" ON public.company_stations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Catering Menu Policies
CREATE POLICY "Public can view active menu items of authorized companies" ON public.catering_menu
    FOR SELECT USING (
        in_stock = true AND is_available = true AND
        EXISTS (
            SELECT 1 FROM public.catering_companies
            WHERE id = catering_menu.company_id AND status = 'AUTHORIZED'
            AND NOW() BETWEEN authorization_start AND authorization_end
        )
    );

CREATE POLICY "Company user can manage own menu" ON public.catering_menu
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND catering_company_id = catering_menu.company_id
        )
    );

CREATE POLICY "Admin can view all menus" ON public.catering_menu
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Catering Orders Policies
CREATE POLICY "Passengers can view own orders" ON public.catering_orders
    FOR SELECT USING (auth.uid() = passenger_id);

CREATE POLICY "Company users can view and update own orders" ON public.catering_orders
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND catering_company_id = catering_orders.company_id
        )
    );

CREATE POLICY "Admin can view all orders" ON public.catering_orders
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );
