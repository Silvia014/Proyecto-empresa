-- Extend business reporting inputs without changing telemetry data.
ALTER TABLE public."Location" ADD COLUMN timezone text;
UPDATE public."Location"
SET timezone = CASE
  WHEN lower(country) IN ('colombia', 'co') THEN 'America/Bogota'
  WHEN lower(city) LIKE '%orlando%' OR lower(city) LIKE '%miami%' THEN 'America/New_York'
  ELSE timezone
END
WHERE timezone IS NULL;

ALTER TABLE public."Order"
  ADD COLUMN "guestCount" integer,
  ADD COLUMN "reservationId" text,
  ADD CONSTRAINT order_reservation_id_key UNIQUE ("reservationId"),
  ADD CONSTRAINT order_guest_count_positive CHECK ("guestCount" IS NULL OR "guestCount" BETWEEN 1 AND 50),
  ADD CONSTRAINT order_reservation_id_fkey
    FOREIGN KEY ("reservationId") REFERENCES public.reservations(id) ON DELETE SET NULL;

CREATE INDEX order_reservation_id_idx ON public."Order" ("reservationId");

ALTER TABLE public.reservations
  ADD COLUMN source text NOT NULL DEFAULT 'ONLINE',
  ADD COLUMN location_id text REFERENCES public."Location"(id) ON DELETE SET NULL,
  ADD COLUMN created_by text,
  ADD CONSTRAINT reservations_source_check CHECK (source IN ('ONLINE', 'STAFF'));

CREATE INDEX reservations_location_date_idx ON public.reservations (location_id, reservation_date);

-- One verified customer rating per order. Customer submissions are made only
-- through the authenticated account API, which verifies order ownership.
CREATE TABLE public.customer_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id text NOT NULL REFERENCES public."Customer"(id) ON DELETE CASCADE,
  order_id text NOT NULL UNIQUE REFERENCES public."Order"(id) ON DELETE CASCADE,
  value_for_money_rating smallint NOT NULL CHECK (value_for_money_rating BETWEEN 1 AND 5),
  comment text NOT NULL DEFAULT '' CHECK (char_length(comment) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX customer_feedback_created_at_idx ON public.customer_feedback (created_at DESC);
ALTER TABLE public.customer_feedback ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.customer_feedback FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.customer_feedback TO service_role;
