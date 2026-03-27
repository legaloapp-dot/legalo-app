-- Historial de pagos de suscripción abogado → plataforma LÉGALO

create table if not exists public.lawyer_subscription_payments (
  id uuid primary key default gen_random_uuid(),
  lawyer_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12, 2) not null,
  currency text not null default 'USD',
  paid_at timestamptz not null,
  description text,
  status text not null default 'completed'
    check (status in ('completed', 'pending', 'refunded')),
  created_at timestamptz default now()
);

create index if not exists lawyer_subscription_payments_lawyer_paid_idx
  on public.lawyer_subscription_payments (lawyer_id, paid_at desc);

alter table public.lawyer_subscription_payments enable row level security;

drop policy if exists "Lawyers read own subscription payments" on public.lawyer_subscription_payments;
create policy "Lawyers read own subscription payments"
  on public.lawyer_subscription_payments for select
  using (auth.uid() = lawyer_id);

-- El abogado puede cancelar su suscripción activa (pasa a básico; la administración puede reactivar)
create or replace function public.lawyer_cancel_own_subscription()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  update public.profiles
  set
    plan = 'basic',
    subscription_expires_at = null
  where id = auth.uid()
    and role = 'lawyer'
    and plan in ('trial', 'premium');
end;
$$;

grant execute on function public.lawyer_cancel_own_subscription() to authenticated;
