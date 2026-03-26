-- Notificaciones in-app para clientes (pagos, cupón, decisión del abogado)

create table if not exists public.client_notifications (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in (
    'payment_approved',
    'payment_rejected',
    'connection_coupon',
    'case_accepted',
    'case_rejected'
  )),
  title text not null,
  body text,
  ref_id uuid,
  read_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists client_notifications_client_created_idx
  on public.client_notifications (client_id, created_at desc);

alter table public.client_notifications enable row level security;

drop policy if exists "Clients read own notifications" on public.client_notifications;
create policy "Clients read own notifications"
  on public.client_notifications for select
  using (auth.uid() = client_id);

drop policy if exists "Clients update own notifications" on public.client_notifications;
create policy "Clients update own notifications"
  on public.client_notifications for update
  using (auth.uid() = client_id);

-- Pago aprobado / rechazado (admin actualiza transactions)
create or replace function public.notify_client_on_transaction_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'approved' and coalesce(old.status, '') is distinct from 'approved' then
      insert into public.client_notifications (client_id, type, title, body, ref_id)
      values (
        new.client_id,
        'payment_approved',
        'Pago confirmado',
        'Tu comprobante fue aprobado. El abogado podrá revisar tu caso cuando corresponda.',
        new.id
      );
    elsif new.status = 'rejected' and coalesce(old.status, '') is distinct from 'rejected' then
      insert into public.client_notifications (client_id, type, title, body, ref_id)
      values (
        new.client_id,
        'payment_rejected',
        'Pago no verificado',
        'Tu comprobante no fue aprobado. Revisa la pestaña Pagos o sube un nuevo comprobante.',
        new.id
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tr_tx_notify_client on public.transactions;
create trigger tr_tx_notify_client
  after update on public.transactions
  for each row
  execute function public.notify_client_on_transaction_status();

-- Caso aceptado o no aceptado por el abogado
create or replace function public.notify_client_on_case_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if old.status = 'pending_approval' and new.status = 'active' then
      insert into public.client_notifications (client_id, type, title, body, ref_id)
      values (
        new.client_id,
        'case_accepted',
        'Caso aceptado',
        'El abogado aceptó tu caso «' || left(trim(coalesce(new.title, 'Sin título')), 120)
          || '». Ya puedes contactarle por WhatsApp desde Mis casos.',
        new.id
      );
    elsif old.status = 'pending_approval' and new.status in ('reassignment_pending', 'rejected_by_lawyer') then
      insert into public.client_notifications (client_id, type, title, body, ref_id)
      values (
        new.client_id,
        'case_rejected',
        'Caso no aceptado',
        'El abogado no aceptó tomar tu caso «' || left(trim(coalesce(new.title, 'Sin título')), 120)
          || '». En Mis casos puedes activar un cupón de conexión o solicitar reembolso.',
        new.id
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tr_cases_notify_client on public.cases;
create trigger tr_cases_notify_client
  after update on public.cases
  for each row
  execute function public.notify_client_on_case_decision();

-- Cupón al registrar connection_credits (tras rechazo)
create or replace function public.notify_client_on_connection_coupon()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.status = 'open' and new.source_case_id is not null then
    insert into public.client_notifications (client_id, type, title, body, ref_id)
    values (
      new.client_id,
      'connection_coupon',
      'Cupón de conexión',
      'Tienes un cupón para contactar a otro abogado de la especialidad «'
        || left(trim(coalesce(new.specialty, '')), 80)
        || '» sin pagar de nuevo el fee. Úsalo en el directorio.',
      new.id
    );
  end if;
  return new;
end;
$$;

do $cc$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'connection_credits'
  ) then
    drop trigger if exists tr_cc_notify_client on public.connection_credits;
    create trigger tr_cc_notify_client
      after insert on public.connection_credits
      for each row
      execute function public.notify_client_on_connection_coupon();
  end if;
end;
$cc$;
