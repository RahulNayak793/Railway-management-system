-- Migration 13: Permanent Cancellation Records Ledger & Non-Destructive Seat Allocation Audit

-- 1. Create permanent cancellation_records table
CREATE TABLE IF NOT EXISTS public.cancellation_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
    pnr TEXT NOT NULL,
    passenger_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    train_id UUID REFERENCES public.trains(id) ON DELETE SET NULL,
    train_number TEXT,
    train_name TEXT,
    journey_date DATE,
    original_fare NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    deduction_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    refund_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    refund_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (refund_status IN ('PENDING', 'PROCESSING', 'REFUNDED', 'APPROVED', 'REJECTED')),
    cancellation_reason TEXT DEFAULT 'Passenger requested cancellation',
    cancellation_type TEXT NOT NULL DEFAULT 'passenger' CHECK (cancellation_type IN ('passenger', 'admin', 'train_service')),
    cancelled_by_user_id UUID,
    cancelled_by_role TEXT NOT NULL DEFAULT 'passenger',
    cancellation_date_time TIMESTAMPTZ DEFAULT NOW(),
    admin_override BOOLEAN DEFAULT FALSE,
    override_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for optimal lookup performance
CREATE INDEX IF NOT EXISTS idx_cancellation_records_pnr ON public.cancellation_records(pnr);
CREATE INDEX IF NOT EXISTS idx_cancellation_records_booking_id ON public.cancellation_records(booking_id);
CREATE INDEX IF NOT EXISTS idx_cancellation_records_passenger_id ON public.cancellation_records(passenger_id);
CREATE INDEX IF NOT EXISTS idx_cancellation_records_date ON public.cancellation_records(cancellation_date_time);
CREATE INDEX IF NOT EXISTS idx_cancellation_records_refund_status ON public.cancellation_records(refund_status);

-- Enable RLS
ALTER TABLE public.cancellation_records ENABLE ROW LEVEL SECURITY;

-- Policies for cancellation_records
CREATE POLICY "Passengers can view their own cancellation records" ON public.cancellation_records
    FOR SELECT USING (auth.uid() = passenger_id);

CREATE POLICY "Staff and Admin can view all cancellation records" ON public.cancellation_records
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('staff', 'admin')
        )
    );

CREATE POLICY "Staff and Admin can update cancellation records" ON public.cancellation_records
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('staff', 'admin')
        )
    );

CREATE POLICY "System/Users can insert cancellation records" ON public.cancellation_records
    FOR INSERT WITH CHECK (true);

-- 2. Update Atomic Booking Cancellation RPC (Non-destructive to seat_allocations)
CREATE OR REPLACE FUNCTION public.cancel_booking_atomic(
    p_booking_id UUID,
    p_user_id UUID,
    p_user_role TEXT,
    p_cancellation_reason TEXT DEFAULT 'Passenger requested cancellation',
    p_refund_amount NUMERIC DEFAULT NULL,
    p_deduction_amount NUMERIC DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_booking RECORD;
    v_train RECORD;
    v_passenger RECORD;
    v_payment RECORD;
    v_original_fare NUMERIC(10,2);
    v_deduction NUMERIC(10,2);
    v_refund NUMERIC(10,2);
    v_refund_status TEXT;
    v_cancellation_type TEXT;
    v_canc_record_id UUID;
    v_result JSON;
BEGIN
    -- A. Retrieve booking details
    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id;

    IF v_booking.id IS NULL THEN
        RAISE EXCEPTION 'Booking not found';
    END IF;

    -- B. Authorization check: Owner, Admin, or Staff
    IF p_user_role NOT IN ('admin', 'staff') AND v_booking.passenger_id <> p_user_id THEN
        RAISE EXCEPTION 'Unauthorized to cancel this booking';
    END IF;

    -- C. Double cancellation prevention
    IF v_booking.status = 'cancelled' THEN
        RAISE EXCEPTION 'Booking is already cancelled';
    END IF;

    -- D. Calculate financial breakdown
    v_original_fare := COALESCE(v_booking.total_fare, 0);
    IF p_refund_amount IS NOT NULL THEN
        v_refund := LEAST(v_original_fare, GREATEST(0, p_refund_amount));
        v_deduction := COALESCE(p_deduction_amount, GREATEST(0, v_original_fare - v_refund));
    ELSE
        -- Default flat fee policy: 10% deduction or 240 flat
        v_deduction := LEAST(v_original_fare, 240.00);
        v_refund := GREATEST(0, v_original_fare - v_deduction);
    END IF;

    v_cancellation_type := CASE 
        WHEN p_user_role IN ('admin', 'staff') THEN 'admin'
        ELSE 'passenger'
    END;

    v_refund_status := CASE 
        WHEN v_refund > 0 THEN 'APPROVED'
        ELSE 'REJECTED'
    END;

    -- E. Update booking status
    UPDATE public.bookings
    SET status = 'cancelled'
    WHERE id = p_booking_id;

    -- F. Retrieve train details for snapshot
    SELECT * INTO v_train
    FROM public.trains
    WHERE id = v_booking.train_id;

    -- G. Insert permanent cancellation_records row
    INSERT INTO public.cancellation_records (
        booking_id,
        pnr,
        passenger_id,
        train_id,
        train_number,
        train_name,
        journey_date,
        original_fare,
        deduction_amount,
        refund_amount,
        refund_status,
        cancellation_reason,
        cancellation_type,
        cancelled_by_user_id,
        cancelled_by_role,
        cancellation_date_time
    ) VALUES (
        p_booking_id,
        v_booking.pnr_number,
        v_booking.passenger_id,
        v_booking.train_id,
        COALESCE(v_train.train_number, 'N/A'),
        COALESCE(v_train.train_name, 'Railway Express'),
        v_booking.travel_date,
        v_original_fare,
        v_deduction,
        v_refund,
        v_refund_status,
        COALESCE(p_cancellation_reason, 'Passenger requested cancellation'),
        v_cancellation_type,
        p_user_id,
        COALESCE(p_user_role, 'passenger'),
        NOW()
    )
    ON CONFLICT (booking_id) DO UPDATE SET
        refund_status = EXCLUDED.refund_status,
        updated_at = NOW()
    RETURNING id INTO v_canc_record_id;

    -- H. Update Payment status to REFUNDED / CANCELLED
    SELECT * INTO v_payment
    FROM public.payments
    WHERE booking_id = p_booking_id;

    IF v_payment.id IS NOT NULL THEN
        UPDATE public.payments
        SET status = CASE WHEN v_refund > 0 THEN 'refunded' ELSE 'failed' END
        WHERE id = v_payment.id;
    END IF;

    -- I. Construct atomic response (Note: seat_allocations are PRESERVED for audit history)
    SELECT json_build_object(
        'success', true,
        'booking_id', p_booking_id,
        'cancellation_record_id', v_canc_record_id,
        'pnr', v_booking.pnr_number,
        'status', 'cancelled',
        'original_fare', v_original_fare,
        'deduction_amount', v_deduction,
        'refund_amount', v_refund,
        'refund_status', v_refund_status
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Safe Backfill for pre-existing cancelled bookings without ledger entries
INSERT INTO public.cancellation_records (
    booking_id,
    pnr,
    passenger_id,
    train_id,
    train_number,
    train_name,
    journey_date,
    original_fare,
    deduction_amount,
    refund_amount,
    refund_status,
    cancellation_reason,
    cancellation_type,
    cancelled_by_role,
    cancellation_date_time
)
SELECT 
    b.id AS booking_id,
    b.pnr_number AS pnr,
    b.passenger_id,
    b.train_id,
    COALESCE(t.train_number, 'N/A'),
    COALESCE(t.train_name, 'Railway Express'),
    b.travel_date AS journey_date,
    COALESCE(b.total_fare, 0) AS original_fare,
    240.00 AS deduction_amount,
    GREATEST(0, COALESCE(b.total_fare, 0) - 240.00) AS refund_amount,
    'APPROVED' AS refund_status,
    'Historical Cancelled Booking' AS cancellation_reason,
    'passenger' AS cancellation_type,
    'passenger' AS cancelled_by_role,
    COALESCE(b.created_at, NOW()) AS cancellation_date_time
FROM public.bookings b
LEFT JOIN public.trains t ON t.id = b.train_id
WHERE b.status = 'cancelled'
ON CONFLICT (booking_id) DO NOTHING;
