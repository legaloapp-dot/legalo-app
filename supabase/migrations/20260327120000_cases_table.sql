-- Tabla `cases` (cartera formal): título, descripción, estado; nombre cliente denormalizado para UI sin RLS extra en profiles.

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

-- Copia desde legal_cases (misma id para no duplicar referencias si las hubiera)
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
