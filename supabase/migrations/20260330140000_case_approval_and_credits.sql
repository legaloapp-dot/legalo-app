-- Estados de caso: aprobación previa del abogado; crédito de conexión y solicitudes de reembolso

alter table public.cases drop constraint if exists cases_status_check;

alter table public.cases add constraint cases_status_check check (
  status in (
    'pending_approval',
    'rejected_by_lawyer',
    'active',
    'in_court',
    'pending',
    'closed',
    'drafting',
    'consulting',
    'paid'
  )
);

create table if not exists public.connection_credits (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  amount_usd numeric(10,2) not null default 25,
  specialty text not null,
  source_case_id uuid not null references public.cases(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'used')),
  used_at timestamptz,
  used_for_lawyer_id uuid references public.profiles(id),
  created_at timestamptz default now(),
  unique(source_case_id)
);

create index if not exists connection_credits_client_open_idx
  on public.connection_credits (client_id, specialty)
  where status = 'open';

alter table public.connection_credits enable row level security;

drop policy if exists "Clients read own connection credits" on public.connection_credits;
create policy "Clients read own connection credits"
  on public.connection_credits for select
  using (auth.uid() = client_id);

drop policy if exists "Client inserts credit for rejected case" on public.connection_credits;
create policy "Client inserts credit for rejected case"
  on public.connection_credits for insert
  with check (
    auth.uid() = client_id
    and exists (
      select 1 from public.cases c
      where c.id = source_case_id
        and c.client_id = auth.uid()
        and c.status = 'rejected_by_lawyer'
    )
  );

drop policy if exists "Client updates own connection credits" on public.connection_credits;
create policy "Client updates own connection credits"
  on public.connection_credits for update
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);

create table if not exists public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  source_case_id uuid not null references public.cases(id) on delete cascade,
  amount_usd numeric(10,2) not null default 25,
  status text not null default 'requested'
    check (status in ('requested', 'processing', 'completed', 'cancelled')),
  created_at timestamptz default now(),
  unique(source_case_id)
);

alter table public.refund_requests enable row level security;

drop policy if exists "Clients read own refund requests" on public.refund_requests;
create policy "Clients read own refund requests"
  on public.refund_requests for select
  using (auth.uid() = client_id);

drop policy if exists "Client inserts refund for rejected case" on public.refund_requests;
create policy "Client inserts refund for rejected case"
  on public.refund_requests for insert
  with check (
    auth.uid() = client_id
    and exists (
      select 1 from public.cases c
      where c.id = source_case_id
        and c.client_id = auth.uid()
        and c.status = 'rejected_by_lawyer'
    )
  );
