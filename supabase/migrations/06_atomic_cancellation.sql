-- Migration 06: Atomic Booking Cancellation & Seat Release

CREATE OR REPLACE FUNCTION public.cancel_booking_atomic(
    p_booking_id UUID,
    p_user_id UUID,
    p_user_role TEXT
)
RETURNS JSON AS $$
DECLARE
    v_passenger_id UUID;
    v_status TEXT;
    v_payment_id UUID;
    v_payment_status TEXT;
    v_result JSON;
BEGIN
    -- 1. Fetch booking details and verify existence
    SELECT passenger_id, status INTO v_passenger_id, v_status
    FROM public.bookings
    WHERE id = p_booking_id;

    IF v_passenger_id IS NULL THEN
        RAISE EXCEPTION 'Booking not found';
    END IF;

    -- 2. Authorization check: Owner or Admin/Staff
    IF p_user_role NOT IN ('admin', 'staff') AND v_passenger_id <> p_user_id THEN
        RAISE EXCEPTION 'Unauthorized to cancel this booking';
    END IF;

    -- 3. Verify booking is cancellable
    IF v_status = 'cancelled' THEN
        RAISE EXCEPTION 'Booking is already cancelled';
    END IF;

    -- 4. Update booking status
    UPDATE public.bookings
    SET status = 'cancelled'
    WHERE id = p_booking_id;

    -- 5. Delete seat allocations to release seats
    DELETE FROM public.seat_allocations
    WHERE booking_id = p_booking_id;

    -- 6. Set refund state on payment to refund_pending
    SELECT id, status INTO v_payment_id, v_payment_status
    FROM public.payments
    WHERE booking_id = p_booking_id;

    IF v_payment_id IS NOT NULL THEN
        UPDATE public.payments
        SET status = 'refund_pending'
        WHERE id = v_payment_id;
    END IF;

    -- 7. Return success details
    SELECT json_build_object(
        'success', true,
        'booking_id', p_booking_id,
        'status', 'cancelled',
        'payment_status', COALESCE(v_payment_status, 'refund_pending')
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
