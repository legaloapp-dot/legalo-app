-- Transacciones: fee contacto vs suscripción Premium abogado (mismo flujo que cliente)

alter table public.transactions
  add column if not exists purpose text not null default 'case_contact'
  check (purpose in ('case_contact', 'lawyer_subscription'));

comment on column public.transactions.purpose is 'case_contact: cliente paga fee al contactar abogado; lawyer_subscription: abogado paga suscripción a la plataforma (client_id = abogado, lawyer_id null).';

alter table public.lawyer_subscription_payments
  add column if not exists transaction_id uuid references public.transactions(id) on delete set null;

create unique index if not exists lawyer_subscription_payments_transaction_id_key
  on public.lawyer_subscription_payments (transaction_id)
  where transaction_id is not null;

-- No enviar notificación «cliente» cuando el pagador es abogado por suscripción
create or replace function public.notify_client_on_transaction_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.purpose, 'case_contact') <> 'case_contact' then
    return new;
  end if;

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

-- Al aprobar pago de suscripción: activar Premium + historial + notificación abogado
alter table public.lawyer_notifications drop constraint if exists lawyer_notifications_type_check;

alter table public.lawyer_notifications
  add constraint lawyer_notifications_type_check
  check (type in (
    'account_approved',
    'new_case',
    'new_lead',
    'case_rated',
    'subscription_approved'
  ));

create or replace function public.apply_lawyer_subscription_on_tx_approve()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.status = 'approved'
     and old.status is distinct from 'approved'
     and coalesce(new.purpose, 'case_contact') = 'lawyer_subscription'
     and new.client_id is not null
  then
    update public.profiles
    set
      plan = 'premium',
      subscription_expires_at = (now() at time zone 'utc') + interval '30 days',
      subscription_paid_at = (now() at time zone 'utc')
    where id = new.client_id
      and role = 'lawyer';

    if not exists (
      select 1 from public.lawyer_subscription_payments p where p.transaction_id = new.id
    ) then
      insert into public.lawyer_subscription_payments (
        lawyer_id,
        amount,
        currency,
        paid_at,
        description,
        status,
        transaction_id
      )
      values (
        new.client_id,
        coalesce(new.amount, 0),
        'USD',
        (now() at time zone 'utc'),
        'Suscripción Premium LÉGALO',
        'completed',
        new.id
      );
    end if;

    if not exists (
      select 1 from public.lawyer_notifications n
      where n.ref_id = new.id and n.type = 'subscription_approved'
    ) then
      insert into public.lawyer_notifications (lawyer_id, type, title, body, ref_id)
      values (
        new.client_id,
        'subscription_approved',
        'Premium activado',
        'Tu pago fue confirmado. Tu plan Premium está activo hasta la fecha indicada en Pagos.',
        new.id
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tr_apply_lawyer_subscription_on_tx on public.transactions;
create trigger tr_apply_lawyer_subscription_on_tx
  after update on public.transactions
  for each row
  execute function public.apply_lawyer_subscription_on_tx_approve();
