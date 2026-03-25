-- ============================================
-- LÉGALO APP - Ejecutar en Supabase SQL Editor
-- Preferido en entornos nuevos: `npx supabase db push` (misma lógica que supabase/migrations/).
-- Este script es acumulativo para pegar en SQL Editor si no usas la CLI.
-- Copia todo y pega en: Dashboard del proyecto → SQL → Run
-- ============================================

-- 1. Extensión UUID
create extension if not exists "uuid-ossp";

-- 2. Tabla profiles
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  role text check (role in ('client', 'lawyer', 'admin')),
  phone text,
  is_verified boolean default false,
  specialty text,
  inpre_number text,
  created_at timestamp with time zone default now()
);

-- 3. Tabla transactions
create table if not exists public.transactions (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references public.profiles(id),
  lawyer_id uuid references public.profiles(id),
  amount decimal,
  status text check (status in ('pending', 'approved', 'rejected')) default 'pending',
  receipt_url text,
  created_at timestamp with time zone default now()
);

-- 4. Trigger: crear perfil al registrarse
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'client')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 5. RLS en profiles
alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "Authenticated users can view lawyer directory" on public.profiles;
create policy "Authenticated users can view lawyer directory" on public.profiles for select
  using (role = 'lawyer' and auth.uid() is not null);

-- 6. RLS en transactions
alter table public.transactions enable row level security;

drop policy if exists "Clients can view own transactions" on public.transactions;
create policy "Clients can view own transactions" on public.transactions for select using (auth.uid() = client_id);

drop policy if exists "Lawyers can view assigned transactions" on public.transactions;
create policy "Lawyers can view assigned transactions" on public.transactions for select using (auth.uid() = lawyer_id);

drop policy if exists "Clients can create transactions" on public.transactions;
create policy "Clients can create transactions" on public.transactions for insert with check (auth.uid() = client_id);

-- 7. Storage buckets
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('lawyer-cards', 'lawyer-cards', false)
on conflict (id) do nothing;

-- 8. Políticas Storage
drop policy if exists "Authenticated can upload receipts" on storage.objects;
create policy "Authenticated can upload receipts" on storage.objects for insert
  with check (bucket_id = 'receipts' and auth.role() = 'authenticated');

drop policy if exists "Authenticated can upload lawyer cards" on storage.objects;
create policy "Authenticated can upload lawyer cards" on storage.objects for insert
  with check (bucket_id = 'lawyer-cards' and auth.role() = 'authenticated');

drop policy if exists "Authenticated can read receipts" on storage.objects;
create policy "Authenticated can read receipts" on storage.objects for select
  using (bucket_id = 'receipts' and auth.role() = 'authenticated');

drop policy if exists "Authenticated can read lawyer cards" on storage.objects;
create policy "Authenticated can read lawyer cards" on storage.objects for select
  using (bucket_id = 'lawyer-cards' and auth.role() = 'authenticated');

-- 9. Onboarding abogado (perfil profesional, pasos 1–4; equivale a 20260324120000_lawyer_onboarding.sql)
alter table public.profiles add column if not exists years_experience integer;
alter table public.profiles add column if not exists professional_bio text;
alter table public.profiles add column if not exists specialty_other text;
alter table public.profiles add column if not exists lawyer_onboarding_step integer default 0;

alter table public.profiles drop constraint if exists profiles_lawyer_onboarding_step_check;
alter table public.profiles add constraint profiles_lawyer_onboarding_step_check
  check (lawyer_onboarding_step is null or (lawyer_onboarding_step >= 0 and lawyer_onboarding_step <= 5));

update public.profiles set lawyer_onboarding_step = 5
where role = 'lawyer' and (lawyer_onboarding_step is null or lawyer_onboarding_step = 0);

update public.profiles set lawyer_onboarding_step = 0 where role = 'client';

create or replace function public.handle_new_user()
returns trigger as $$
declare
  r text;
begin
  r := coalesce(new.raw_user_meta_data->>'role', 'client');
  insert into public.profiles (id, full_name, role, lawyer_onboarding_step)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    r,
    case when r = 'lawyer' then 1 else 0 end
  );
  return new;
end;
$$ language plpgsql security definer;

-- 10. Rutas de documentos verificación (paso 2 abogado, bucket lawyer-cards; equivale a 20260325120000_lawyer_verification_docs.sql)
alter table public.profiles add column if not exists lawyer_inpre_card_path text;
alter table public.profiles add column if not exists lawyer_cedula_path text;
alter table public.profiles add column if not exists lawyer_verification_rejected_at timestamptz;

-- 11. Dashboard abogado: legal_cases, leads, lawyer_activity + trigger pago aprobado (20260326120000_dashboard_legal_data.sql)
alter table public.profiles
  add column if not exists accepting_cases boolean default true,
  add column if not exists professional_rating numeric(3,2);

create table if not exists public.legal_cases (
  id uuid primary key default gen_random_uuid(),
  lawyer_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid references public.profiles(id) on delete set null,
  title text not null,
  status text not null default 'consulting'
    check (status in ('consulting', 'paid', 'drafting', 'closed')),
  last_activity text,
  last_activity_at timestamptz default now(),
  created_at timestamptz default now()
);

create index if not exists legal_cases_lawyer_id_idx on public.legal_cases (lawyer_id);
create index if not exists legal_cases_client_id_idx on public.legal_cases (client_id);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  lawyer_id uuid not null references public.profiles(id) on delete cascade,
  client_name text not null,
  category text,
  message text,
  phone_e164 text not null,
  status text not null default 'new' check (status in ('new', 'contacted', 'dismissed')),
  created_at timestamptz default now()
);

create index if not exists leads_lawyer_id_idx on public.leads (lawyer_id);

create table if not exists public.lawyer_activity (
  id uuid primary key default gen_random_uuid(),
  lawyer_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null
    check (event_type in ('review', 'payment', 'lead_view', 'case_update', 'system')),
  title text not null,
  body text,
  created_at timestamptz default now()
);

create index if not exists lawyer_activity_lawyer_id_idx on public.lawyer_activity (lawyer_id, created_at desc);

alter table public.legal_cases enable row level security;
alter table public.leads enable row level security;
alter table public.lawyer_activity enable row level security;

drop policy if exists "Lawyers full access own legal_cases" on public.legal_cases;
create policy "Lawyers full access own legal_cases"
  on public.legal_cases for all
  using (auth.uid() = lawyer_id)
  with check (auth.uid() = lawyer_id);

drop policy if exists "Clients read own legal_cases" on public.legal_cases;
create policy "Clients read own legal_cases"
  on public.legal_cases for select
  using (auth.uid() = client_id);

drop policy if exists "Lawyers read own leads" on public.leads;
create policy "Lawyers read own leads"
  on public.leads for select
  using (auth.uid() = lawyer_id);

drop policy if exists "Lawyers update own leads" on public.leads;
create policy "Lawyers update own leads"
  on public.leads for update
  using (auth.uid() = lawyer_id);

drop policy if exists "Authenticated insert leads for lawyers" on public.leads;
create policy "Authenticated insert leads for lawyers"
  on public.leads for insert
  with check (
    auth.role() = 'authenticated'
    and exists (select 1 from public.profiles p where p.id = lawyer_id and p.role = 'lawyer')
  );

drop policy if exists "Lawyers read own activity" on public.lawyer_activity;
create policy "Lawyers read own activity"
  on public.lawyer_activity for select
  using (auth.uid() = lawyer_id);

drop policy if exists "Lawyers insert own activity" on public.lawyer_activity;
create policy "Lawyers insert own activity"
  on public.lawyer_activity for insert
  with check (auth.uid() = lawyer_id);

create or replace function public.on_transaction_approved_activity()
returns trigger as $$
begin
  if tg_op = 'UPDATE' and new.status = 'approved' and old.status is distinct from 'approved'
     and new.lawyer_id is not null then
    insert into public.lawyer_activity (lawyer_id, event_type, title, body)
    values (
      new.lawyer_id,
      'payment',
      'Pago confirmado',
      coalesce(trim(to_char(new.amount, 'FM999999990.00')), '') || ' USD'
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists tr_transaction_approved_activity on public.transactions;
create trigger tr_transaction_approved_activity
  after update on public.transactions
  for each row execute function public.on_transaction_approved_activity();

-- 12. Tabla cases + RLS + copia desde legal_cases (20260327120000_cases_table.sql)
create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  lawyer_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  client_display_name text,
  status text not null default 'active'
    check (status in (
      'active',
      'in_court',
      'pending',
      'closed',
      'drafting',
      'consulting',
      'paid'
    )),
  last_activity text,
  last_activity_at timestamptz default now(),
  created_at timestamptz default now()
);

create index if not exists cases_lawyer_id_idx on public.cases (lawyer_id);
create index if not exists cases_client_id_idx on public.cases (client_id);
create index if not exists cases_status_idx on public.cases (status);

insert into public.cases (
  id,
  client_id,
  lawyer_id,
  title,
  description,
  client_display_name,
  status,
  last_activity,
  last_activity_at,
  created_at
)
select
  lc.id,
  lc.client_id,
  lc.lawyer_id,
  lc.title,
  null::text,
  p.full_name,
  case lc.status
    when 'consulting' then 'consulting'
    when 'paid' then 'paid'
    when 'drafting' then 'drafting'
    when 'closed' then 'closed'
    else 'active'
  end,
  lc.last_activity,
  lc.last_activity_at,
  lc.created_at
from public.legal_cases lc
left join public.profiles p on p.id = lc.client_id
where lc.client_id is not null
on conflict (id) do nothing;

alter table public.cases enable row level security;

drop policy if exists "Lawyers full access own cases" on public.cases;
create policy "Lawyers full access own cases"
  on public.cases for all
  using (auth.uid() = lawyer_id)
  with check (auth.uid() = lawyer_id);

drop policy if exists "Clients read own cases" on public.cases;
create policy "Clients read own cases"
  on public.cases for select
  using (auth.uid() = client_id);

drop policy if exists "Clients insert own cases" on public.cases;
create policy "Clients insert own cases"
  on public.cases for insert
  with check (
    auth.uid() = client_id
    and exists (select 1 from public.profiles lp where lp.id = lawyer_id and lp.role = 'lawyer')
  );

drop policy if exists "Clients update own cases" on public.cases;
create policy "Clients update own cases"
  on public.cases for update
  using (auth.uid() = client_id);
