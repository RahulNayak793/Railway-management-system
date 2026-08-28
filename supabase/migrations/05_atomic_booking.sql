-- Migration 05: Atomic Booking Transaction & Idempotency Persistence

-- 1. Create table to store client idempotency keys
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
    key UUID PRIMARY KEY,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on idempotency_keys
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Allow staff/admin and authenticated owners to select
CREATE POLICY "Users can select their own idempotency keys" ON public.idempotency_keys
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.bookings
            WHERE bookings.id = booking_id AND bookings.passenger_id = auth.uid()
        )
        OR public.get_user_role(auth.uid()) IN ('staff', 'admin')
    );

-- 2. Create the atomic booking database function
CREATE OR REPLACE FUNCTION public.create_booking_atomic(
    p_passenger_id UUID,
    p_train_id UUID,
    p_travel_date DATE,
    p_coach_class TEXT,
    p_passengers JSONB,
    p_total_fare NUMERIC,
    p_idempotency_key UUID
)
RETURNS JSON AS $$
DECLARE
    v_existing_booking_id UUID;
    v_booking_id UUID;
    v_pnr TEXT;
    v_status TEXT;
    v_passenger_count INT;
    v_available_seats UUID[];
    v_rac_count INT;
    v_passenger JSONB;
    v_seat_id UUID;
    v_result JSON;
    i INT;
BEGIN
    -- Step A: Check if the idempotency key already exists
    SELECT booking_id INTO v_existing_booking_id
    FROM public.idempotency_keys
    WHERE key = p_idempotency_key;

    IF v_existing_booking_id IS NOT NULL THEN
        -- Fetch existing booking and allocations
        SELECT json_build_object(
            'retrieved_from_idempotency', true,
            'booking', (
                SELECT row_to_json(b) FROM (
                    SELECT * FROM public.bookings WHERE id = v_existing_booking_id
                ) b
            ),
            'allocations', (
                SELECT json_agg(row_to_json(a)) FROM (
                    SELECT * FROM public.seat_allocations WHERE booking_id = v_existing_booking_id
                ) a
            )
        ) INTO v_result;
        RETURN v_result;
    END IF;

    -- Step B: Validate parameters
    v_passenger_count := jsonb_array_length(p_passengers);
    IF v_passenger_count = 0 THEN
        RAISE EXCEPTION 'Missing passengers list';
    END IF;

    -- Step C: Find available seats
    -- Query seats in the same train and coach class that do not have active allocations on travel_date
    SELECT array_agg(id) INTO v_available_seats
    FROM (
        SELECT id FROM public.seats
        WHERE train_id = p_train_id AND coach_class = p_coach_class
        ORDER BY coach_number, seat_number
    ) s
    WHERE id NOT IN (
        SELECT seat_id FROM public.seat_allocations
        WHERE travel_date = p_travel_date AND seat_id IS NOT NULL
    );

    -- Step D: Determine Booking Status
    IF COALESCE(cardinality(v_available_seats), 0) >= v_passenger_count THEN
        v_status := 'confirmed';
    ELSE
        -- Fallback to RAC or Waitlist based on count of active bookings
        SELECT count(*) INTO v_rac_count
        FROM public.bookings
        WHERE train_id = p_train_id 
          AND travel_date = p_travel_date 
          AND status = 'rac';

        IF v_rac_count < 4 THEN
            v_status := 'rac';
        ELSE
            v_status := 'waitlist';
        END IF;
    END IF;

    -- Step E: Generate a unique PNR
    LOOP
        v_pnr := (floor(random() * 9000000000) + 1000000000)::text;
        EXIT WHEN NOT EXISTS (
            SELECT 1 FROM public.bookings WHERE pnr_number = v_pnr
        );
    END LOOP;

    -- Step F: Create Booking record
    INSERT INTO public.bookings (passenger_id, train_id, travel_date, pnr_number, status, total_fare)
    VALUES (p_passenger_id, p_train_id, p_travel_date, v_pnr, v_status, p_total_fare)
    RETURNING id INTO v_booking_id;

    -- Step G: Create Seat Allocations
    FOR i IN 0..v_passenger_count - 1 LOOP
        v_passenger := p_passengers->i;
        v_seat_id := NULL;
        
        IF v_status = 'confirmed' THEN
            v_seat_id := v_available_seats[i + 1];
        END IF;

        INSERT INTO public.seat_allocations (
            booking_id, seat_id, travel_date, passenger_name, passenger_age, passenger_gender
        )
        VALUES (
            v_booking_id, 
            v_seat_id, 
            p_travel_date, 
            COALESCE(v_passenger->>'full_name', v_passenger->>'name'), 
            (v_passenger->>'age')::integer, 
            COALESCE(v_passenger->>'gender', 'Male')
        );
    END LOOP;

    -- Step H: Persist Idempotency Key
    INSERT INTO public.idempotency_keys (key, booking_id)
    VALUES (p_idempotency_key, v_booking_id);

    -- Step I: Return the newly created details
    SELECT json_build_object(
        'retrieved_from_idempotency', false,
        'booking', (
            SELECT row_to_json(b) FROM (
                SELECT * FROM public.bookings WHERE id = v_booking_id
            ) b
        ),
        'allocations', (
            SELECT json_agg(row_to_json(a)) FROM (
                SELECT * FROM public.seat_allocations WHERE booking_id = v_booking_id
            ) a
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
