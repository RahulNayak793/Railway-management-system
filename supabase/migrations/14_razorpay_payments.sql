-- Migration 14: Central Razorpay Payments Table & RLS Policies
-- Supports TICKET_BOOKING, WALLET_RECHARGE, and FOOD_ORDER

CREATE TABLE IF NOT EXISTS public.razorpay_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    payment_type VARCHAR(50) NOT NULL CHECK (payment_type IN ('TICKET_BOOKING', 'WALLET_RECHARGE', 'FOOD_ORDER')),
    reference_id VARCHAR(100) NOT NULL,
    razorpay_order_id VARCHAR(100) UNIQUE NOT NULL,
    razorpay_payment_id VARCHAR(100) UNIQUE,
    razorpay_signature TEXT,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(10) DEFAULT 'INR',
    status VARCHAR(50) NOT NULL DEFAULT 'CREATED' CHECK (status IN ('CREATED', 'PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED')),
    payment_method VARCHAR(50),
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    failure_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    paid_at TIMESTAMPTZ
);

-- Indexes for fast query lookup & uniqueness protection
CREATE INDEX IF NOT EXISTS idx_razorpay_payments_user_id ON public.razorpay_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_razorpay_payments_reference_id ON public.razorpay_payments(reference_id);
CREATE INDEX IF NOT EXISTS idx_razorpay_payments_status ON public.razorpay_payments(status);
CREATE INDEX IF NOT EXISTS idx_razorpay_payments_order_id ON public.razorpay_payments(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_razorpay_payments_payment_id ON public.razorpay_payments(razorpay_payment_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.razorpay_payments ENABLE ROW LEVEL SECURITY;

-- Policy: Passengers can view their own payment records
CREATE POLICY "Passengers can view own razorpay payments"
ON public.razorpay_payments
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Admin and Staff can view all payment records
CREATE POLICY "Staff and Admins can view all razorpay payments"
ON public.razorpay_payments
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'staff')
    )
);

-- Policy: Backend service role has full access
CREATE POLICY "Service role full access on razorpay payments"
ON public.razorpay_payments
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
