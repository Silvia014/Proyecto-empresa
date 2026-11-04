-- Website intake and Brasapuntos hub migration. Applied to the approved development project.

ALTER TABLE public."Customer"
  ADD COLUMN IF NOT EXISTS "authUserId" text UNIQUE;

CREATE TABLE IF NOT EXISTS public.reservations (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  customer_id text NOT NULL REFERENCES public."Customer"(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  country text NOT NULL,
  city text NOT NULL,
  party_size integer NOT NULL CHECK (party_size BETWEEN 1 AND 20),
  reservation_date date NOT NULL,
  reservation_time time NOT NULL,
  location_preference text,
  notes text,
  referral_source text,
  status text NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'CONFIRMED', 'CANCELLED', 'COMPLETED')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reservations_created_at_idx ON public.reservations (created_at DESC);
CREATE INDEX IF NOT EXISTS reservations_customer_date_idx ON public.reservations (customer_id, reservation_date DESC);

CREATE TABLE IF NOT EXISTS public.candidate_applications (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  position text NOT NULL,
  linkedin_url text,
  experience_years integer NOT NULL DEFAULT 0 CHECK (experience_years >= 0),
  cv_path text NOT NULL,
  cv_filename text NOT NULL,
  status text NOT NULL DEFAULT 'RECEIVED' CHECK (status IN ('RECEIVED', 'IN_PROGRESS', 'SELECTED', 'DISCARDED')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS candidate_applications_created_at_idx ON public.candidate_applications (created_at DESC);
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_applications ENABLE ROW LEVEL SECURITY;

-- Match a guest reservation by email, link it on account creation, and create
-- a zero-point Brasapoints account only for a registered member.
CREATE OR REPLACE FUNCTION public.ensure_brasaland_customer(
  p_user_id text,
  p_name text,
  p_email text,
  p_phone text DEFAULT NULL,
  p_country text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_create_membership boolean DEFAULT false
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  normalized_email text := lower(trim(p_email));
  customer_id text;
BEGIN
  IF normalized_email = '' OR position('@' in normalized_email) < 2 THEN
    RAISE EXCEPTION 'A valid email is required';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(normalized_email, 0));

  IF p_user_id IS NOT NULL THEN
    SELECT id INTO customer_id FROM public."Customer" WHERE "authUserId" = p_user_id LIMIT 1;
  END IF;
  IF customer_id IS NULL THEN
    SELECT id INTO customer_id FROM public."Customer"
    WHERE lower(email) = normalized_email
      AND (p_user_id IS NULL OR "authUserId" IS NULL OR "authUserId" = p_user_id)
    ORDER BY "createdAt" ASC LIMIT 1 FOR UPDATE;
  END IF;

  IF customer_id IS NULL THEN
    customer_id := gen_random_uuid()::text;
    INSERT INTO public."Customer" (id, name, email, phone, country, city, "createdAt", "updatedAt", "authUserId")
    VALUES (customer_id, trim(p_name), normalized_email, nullif(trim(p_phone), ''), p_country, p_city, now(), now(), p_user_id);
  ELSE
    UPDATE public."Customer"
    SET name = COALESCE(NULLIF(trim(name), ''), trim(p_name)),
        email = normalized_email,
        phone = COALESCE(NULLIF(trim(phone), ''), nullif(trim(p_phone), '')),
        country = COALESCE(country, p_country),
        city = COALESCE(city, p_city),
        "authUserId" = COALESCE("authUserId", p_user_id),
        "updatedAt" = now()
    WHERE id = customer_id;
  END IF;

  IF p_create_membership THEN
    INSERT INTO public."BrasapointsAccount" (id, "customerId", balance, "createdAt", "updatedAt")
    VALUES (gen_random_uuid()::text, customer_id, 0, now(), now())
    ON CONFLICT ("customerId") DO NOTHING;
  END IF;
  RETURN customer_id;
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_brasaland_customer(text, text, text, text, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_brasaland_customer(text, text, text, text, text, text, boolean) TO service_role;

-- Private CV objects are accessed through server-generated signed URLs.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('candidate-cvs', 'candidate-cvs', false, 3145728,
        ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 3145728,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
