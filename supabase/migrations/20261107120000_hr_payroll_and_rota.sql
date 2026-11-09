-- HR-managed payroll and rota records. These tables are accessed only through
-- authenticated CRM server routes using the Supabase service role.
CREATE TABLE IF NOT EXISTS public.hr_payroll_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_name text NOT NULL CHECK (char_length(employee_name) BETWEEN 1 AND 120),
  employee_email text,
  pay_period_start date NOT NULL,
  pay_period_end date NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL CHECK (currency IN ('USD', 'COP', 'EUR')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  paid_at timestamptz,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (pay_period_end >= pay_period_start)
);
CREATE INDEX IF NOT EXISTS hr_payroll_period_idx ON public.hr_payroll_entries (pay_period_start DESC, employee_name);

CREATE TABLE IF NOT EXISTS public.hr_rota_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_name text NOT NULL CHECK (char_length(employee_name) BETWEEN 1 AND 120),
  employee_email text,
  location_id text REFERENCES public."Location"(id) ON DELETE SET NULL,
  shift_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  role text,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);
CREATE INDEX IF NOT EXISTS hr_rota_shifts_date_location_idx ON public.hr_rota_shifts (shift_date, location_id);

ALTER TABLE public.hr_payroll_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_rota_shifts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.hr_payroll_entries, public.hr_rota_shifts FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.hr_payroll_entries, public.hr_rota_shifts TO service_role;
