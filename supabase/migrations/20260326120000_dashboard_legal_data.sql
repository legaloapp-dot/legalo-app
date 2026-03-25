-- Dashboard abogado + datos funcionales (casos, leads, actividad)
-- Ingresos: tabla existente `transactions`

alter table public.profiles
  add column if not exists accepting_cases boolean default true,
  add column if not exists professional_rating numeric(3,2);

-- Casos asignados a un abogado (opcionalmente vinculados a un cliente)
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

-- Solicitudes / leads dirigidos a un abogado
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

-- Actividad reciente (feed del dashboard)
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

-- Registrar pago aprobado como actividad (trigger con SECURITY DEFINER)
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
