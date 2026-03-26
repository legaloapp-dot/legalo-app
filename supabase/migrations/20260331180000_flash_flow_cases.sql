-- Flujo "Flash": caso enlazado al comprobante; el abogado solo ve el caso cuando el pago está APPROVED.
-- Estado reassignment_pending cuando el abogado rechaza (reubicación / cupón).

alter table public.cases add column if not exists transaction_id uuid references public.transactions(id) on delete set null;

create index if not exists cases_transaction_id_idx on public.cases (transaction_id);

alter table public.cases drop constraint if exists cases_status_check;
alter table public.cases add constraint cases_status_check check (
  status in (
    'awaiting_payment',
    'pending_approval',
    'rejected_by_lawyer',
    'reassignment_pending',
    'active',
    'in_court',
    'pending',
    'closed',
    'drafting',
    'consulting',
    'paid'
  )
);

-- No notificar al abogado al crear caso si aún falta validar el pago
create or replace function public.notify_lawyer_on_new_case()
returns trigger as $$
begin
  if new.status = 'awaiting_payment' then
    return new;
  end if;
  insert into public.lawyer_notifications (lawyer_id, type, title, body, ref_id)
  values (
    new.lawyer_id,
    'new_case',
    'Nueva solicitud de caso',
    trim(
      coalesce(new.client_display_name, 'Un cliente')
      || ' envió el caso: '
      || coalesce(new.title, 'Sin título')
    ),
    new.id
  );
  return new;
end;
$$ language plpgsql security definer;

-- Al aprobar el pago: el caso pasa a pendiente de aprobación del abogado + notificación
create or replace function public.promote_case_when_payment_approved()
returns trigger as $$
begin
  if tg_op = 'UPDATE' and new.status = 'approved' and old.status is distinct from 'approved' then
    update public.cases
    set
      status = 'pending_approval',
      last_activity = 'Pago verificado: pendiente de tu aprobación',
      last_activity_at = now()
    where transaction_id = new.id and status = 'awaiting_payment';

    insert into public.lawyer_notifications (lawyer_id, type, title, body, ref_id)
    select
      c.lawyer_id,
      'new_case',
      'Nuevo caso pagado',
      'Revisa los detalles del caso para aceptar o rechazar la solicitud.',
      c.id
    from public.cases c
    where c.transaction_id = new.id and c.status = 'pending_approval';
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists tr_promote_case_on_payment on public.transactions;
create trigger tr_promote_case_on_payment
  after update on public.transactions
  for each row execute function public.promote_case_when_payment_approved();

-- RLS cupones/reembolsos: aceptar rechazo formal o reasignación pendiente
drop policy if exists "Client inserts credit for rejected case" on public.connection_credits;
create policy "Client inserts credit for rejected case"
  on public.connection_credits for insert
  with check (
    auth.uid() = client_id
    and exists (
      select 1 from public.cases c
      where c.id = source_case_id
        and c.client_id = auth.uid()
        and c.status in ('rejected_by_lawyer', 'reassignment_pending')
    )
  );

drop policy if exists "Client inserts refund for rejected case" on public.refund_requests;
create policy "Client inserts refund for rejected case"
  on public.refund_requests for insert
  with check (
    auth.uid() = client_id
    and exists (
      select 1 from public.cases c
      where c.id = source_case_id
        and c.client_id = auth.uid()
        and c.status in ('rejected_by_lawyer', 'reassignment_pending')
    )
  );
