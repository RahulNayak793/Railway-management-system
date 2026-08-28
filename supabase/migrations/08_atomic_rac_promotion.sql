-- Migration 08: Atomic RAC / Waitlist Berth Promotion & Concurrency Control

CREATE OR REPLACE FUNCTION public.promote_rac_booking_atomic(
    p_booking_id UUID,
    p_admin_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_booking RECORD;
    v_available_seat_id UUID;
    v_seat RECORD;
    v_allocation_id UUID;
    v_result JSON;
BEGIN
    -- 1. Lock booking row for update to prevent concurrent promotions
    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id
    FOR UPDATE;

    IF v_booking.id IS NULL THEN
        RAISE EXCEPTION 'Booking not found';
    END IF;

    -- 2. Verify booking is in RAC or waitlist status
    IF v_booking.status NOT IN ('rac', 'waitlist') THEN
        RAISE EXCEPTION 'Booking % is not in RAC or waitlist status (current status: %)', p_booking_id, v_booking.status;
    END IF;

    -- 3. Find an unallocated seat for this train and coach class on travel_date
    SELECT s.id, s.coach_number, s.seat_number, s.berth_type INTO v_seat
    FROM public.seats s
    WHERE s.train_id = v_booking.train_id
      AND s.id NOT IN (
          SELECT sa.seat_id 
          FROM public.seat_allocations sa 
          WHERE sa.travel_date = v_booking.travel_date 
            AND sa.seat_id IS NOT NULL
      )
    ORDER BY s.coach_number, s.seat_number
    LIMIT 1;

    IF v_seat.id IS NULL THEN
        RAISE EXCEPTION 'No available berths to promote booking % on %', p_booking_id, v_booking.travel_date;
    END IF;

    -- 4. Update seat allocation for this booking
    SELECT id INTO v_allocation_id
    FROM public.seat_allocations
    WHERE booking_id = p_booking_id
    LIMIT 1;

    IF v_allocation_id IS NOT NULL THEN
        UPDATE public.seat_allocations
        SET seat_id = v_seat.id
        WHERE id = v_allocation_id;
    ELSE
        INSERT INTO public.seat_allocations (
            booking_id, seat_id, travel_date, passenger_name, passenger_age, passenger_gender
        ) VALUES (
            p_booking_id, v_seat.id, v_booking.travel_date, 'Promoted Passenger', 30, 'Male'
        );
    END IF;

    -- 5. Update booking status to confirmed
    UPDATE public.bookings
    SET status = 'confirmed'
    WHERE id = p_booking_id;

    -- 6. Return successful promotion details
    SELECT json_build_object(
        'success', true,
        'booking_id', p_booking_id,
        'pnr_number', v_booking.pnr_number,
        'status', 'confirmed',
        'assigned_seat', json_build_object(
            'seat_id', v_seat.id,
            'coach_number', v_seat.coach_number,
            'seat_number', v_seat.seat_number,
            'berth_type', v_seat.berth_type
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
