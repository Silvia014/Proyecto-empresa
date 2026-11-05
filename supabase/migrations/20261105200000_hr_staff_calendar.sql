-- HR-managed calendar for staff absences, holiday requests, and bank holidays.
create table if not exists public.hr_calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  event_type text not null check (event_type in ('absence', 'holiday_request', 'bank_holiday')),
  employee_name text,
  location_id text references public."Location" (id) on delete set null,
  start_date date not null,
  end_date date not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_calendar_events_date_range_check check (end_date >= start_date),
  constraint hr_bank_holiday_approved_check check (event_type <> 'bank_holiday' or status = 'approved')
);

create index if not exists hr_calendar_events_dates_idx
  on public.hr_calendar_events (start_date, end_date);
create index if not exists hr_calendar_events_location_dates_idx
  on public.hr_calendar_events (location_id, start_date, end_date);

alter table public.hr_calendar_events enable row level security;
revoke all on table public.hr_calendar_events from anon, authenticated;
grant all on table public.hr_calendar_events to service_role;
