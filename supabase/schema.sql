-- Autopedant · Supabase free
-- SQL Editor → New query → Run
-- Auth → Providers → Email: vypnúť "Confirm email"

create table if not exists public.customers (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default '',
  phone text not null default '',
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.vehicles (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  customer_id text not null references public.customers (id) on delete cascade,
  license_plate text,
  vin text not null default '',
  make_model text not null,
  year integer not null,
  first_registration_date date,
  engine_displacement numeric not null,
  fuel text not null,
  created_at timestamptz not null default now(),
  unique (user_id, license_plate)
);

create table if not exists public.records (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  vehicle_id text not null references public.vehicles (id) on delete cascade,
  service_date date not null,
  mileage integer not null,
  labor_cost numeric not null default 0,
  material_earnings numeric,
  billed_amount numeric,
  mechanic_notes text not null default '',
  next_service_date date,
  next_service_mileage integer,
  created_at timestamptz not null default now()
);

create table if not exists public.record_items (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  record_id text not null references public.records (id) on delete cascade,
  category text not null,
  action_type text not null,
  part_name text not null default '',
  part_brand text not null default '',
  material_type text not null default '',
  quantity text not null default '',
  purchase_price numeric not null default 0,
  sell_price numeric not null default 0,
  sort_index integer not null default 0
);

alter table public.record_items add column if not exists diagnostic_scope text;
alter table public.record_items add column if not exists diagnostic_unit text;
alter table public.record_items add column if not exists diagnostic_note text;
alter table public.record_items add column if not exists diagnostic_resolved boolean;
alter table public.record_items add column if not exists diagnostic_report_id text;
alter table public.record_items add column if not exists diagnostic_report_name text;
alter table public.record_items add column if not exists diagnostic_report_path text;

create index if not exists customers_user_id_idx on public.customers (user_id);
create index if not exists vehicles_user_id_idx on public.vehicles (user_id);
create index if not exists records_user_id_idx on public.records (user_id);
create index if not exists records_vehicle_id_idx on public.records (vehicle_id);
create index if not exists record_items_record_id_idx on public.record_items (record_id);

alter table public.customers enable row level security;
alter table public.vehicles enable row level security;
alter table public.records enable row level security;
alter table public.record_items enable row level security;

drop policy if exists customers_own on public.customers;
create policy customers_own on public.customers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists vehicles_own on public.vehicles;
create policy vehicles_own on public.vehicles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists records_own on public.records;
create policy records_own on public.records
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists record_items_own on public.record_items;
create policy record_items_own on public.record_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.change_events (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null,
  title text not null,
  detail text not null default '',
  vehicle_id text,
  created_at timestamptz not null default now()
);

alter table public.change_events add column if not exists kind text;
alter table public.change_events add column if not exists reverted boolean not null default false;
alter table public.change_events add column if not exists payload jsonb;

create index if not exists change_events_user_id_idx on public.change_events (user_id);
create index if not exists change_events_at_idx on public.change_events (user_id, at desc);

alter table public.change_events enable row level security;

drop policy if exists change_events_own on public.change_events;
create policy change_events_own on public.change_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('diagnostic-reports', 'diagnostic-reports', false, 8388608, array['application/pdf'])
on conflict (id) do nothing;

drop policy if exists diagnostic_reports_own on storage.objects;
create policy diagnostic_reports_own on storage.objects
  for all
  using (
    bucket_id = 'diagnostic-reports'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'diagnostic-reports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
