-- Seed Stations
INSERT INTO public.stations (station_code, station_name) VALUES
('NDLS', 'New Delhi'),
('MMCT', 'Mumbai Central'),
('BPL', 'Bhopal Junction'),
('BSB', 'Varanasi Junction'),
('HWH', 'Howrah Junction'),
('AGC', 'Agra Cantt'),
('NZM', 'Hazrat Nizamuddin'),
('GWL', 'Gwalior Junction'),
('BOM', 'Mumbai CSMT'),
('DEL', 'Delhi Junction'),
('PAT', 'Patna Junction')
ON CONFLICT (station_code) DO NOTHING;

-- Seed Trains
INSERT INTO public.trains (id, train_number, train_name, status, delay_minutes) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '12952', 'Rajdhani Express', 'on_time', 0),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', '12002', 'Shatabdi Express', 'delayed', 15),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', '22436', 'Vande Bharat Express', 'on_time', 0),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', '12301', 'Kolkata Rajdhani', 'cancelled', 0),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', '12050', 'Gatimaan Express', 'on_time', 0)
ON CONFLICT (train_number) DO NOTHING;

-- Seed Routes
-- Rajdhani Route: New Delhi to Mumbai Central
INSERT INTO public.routes (train_id, source_station_code, destination_station_code, departure_time, arrival_time, distance_km, fare_multiplier, stop_sequence) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'NDLS', 'MMCT', '16:30:00', '08:15:00', 1384.00, 1.50, 1),
-- Shatabdi Route: New Delhi to Bhopal
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'NDLS', 'BPL', '06:00:00', '14:25:00', 707.00, 1.20, 1),
-- Vande Bharat: New Delhi to Varanasi
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'NDLS', 'BSB', '06:00:00', '14:00:00', 759.00, 1.30, 1),
-- Kolkata Rajdhani: Howrah to New Delhi
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'HWH', 'NDLS', '16:55:00', '10:00:00', 1450.00, 1.50, 1),
-- Gatimaan Express: Hazrat Nizamuddin to Agra Cantt
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', 'NZM', 'AGC', '08:10:00', '09:50:00', 188.00, 1.10, 1);

-- Seed Seats for trains
-- We will write a function to generate seats programmatically to avoid an overly verbose SQL insert
CREATE OR REPLACE FUNCTION seed_train_seats(t_id UUID) RETURNS VOID AS $$
DECLARE
    coach_classes TEXT[] := ARRAY['SL', '3A', '2A', '1A'];
    coach_cls TEXT;
    c_num TEXT;
    s_num INT;
    b_type TEXT;
BEGIN
    FOREACH coach_cls IN ARRAY coach_classes LOOP
        -- Generate 2 coaches per class
        FOR coach_idx IN 1..2 LOOP
            c_num := CASE 
                WHEN coach_cls = 'SL' THEN 'S' || coach_idx
                WHEN coach_cls = '3A' THEN 'B' || coach_idx
                WHEN coach_cls = '2A' THEN 'A' || coach_idx
                WHEN coach_cls = '1A' THEN 'H' || coach_idx
            END;

            -- 36 seats per coach (6 cabins of 6 seats for simplicity)
            FOR s_num IN 1..36 LOOP
                -- Berth logic
                -- 1, 2 = Lower (LB), 3, 4 = Middle (MB), 5, 6 = Upper (UB)
                b_type := CASE (s_num - 1) % 6
                    WHEN 0 THEN 'LB'
                    WHEN 1 THEN 'LB'
                    WHEN 2 THEN 'MB'
                    WHEN 3 THEN 'MB'
                    WHEN 4 THEN 'UB'
                    WHEN 5 THEN 'UB'
                END;

                INSERT INTO public.seats (train_id, coach_class, coach_number, seat_number, berth_type)
                VALUES (t_id, coach_cls, c_num, s_num, b_type)
                ON CONFLICT (train_id, coach_number, seat_number) DO NOTHING;
            END LOOP;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute for all trains
SELECT seed_train_seats('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
SELECT seed_train_seats('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12');
SELECT seed_train_seats('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13');
SELECT seed_train_seats('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14');
SELECT seed_train_seats('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15');

-- Clean up seeding function
DROP FUNCTION seed_train_seats;
