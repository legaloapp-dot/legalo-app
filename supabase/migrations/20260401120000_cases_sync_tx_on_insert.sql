-- Caso creado después de que el pago ya fue aprobado → pending_approval en el mismo INSERT.
-- + backfill de filas atascadas awaiting_payment + tx approved.

create or replace function public.cases_sync_with_transaction_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tx_status text;
begin
  if new.transaction_id is not null and new.status = 'awaiting_payment' then
    select t.status into tx_status
    from public.transactions t
    where t.id = new.transaction_id;

    if tx_status = 'approved' then
      new.status := 'pending_approval';
      new.last_activity := 'Pago verificado: pendiente de tu aprobación';
      new.last_activity_at := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tr_cases_sync_tx_on_insert on public.cases;
create trigger tr_cases_sync_tx_on_insert
  before insert on public.cases
  for each row execute function public.cases_sync_with_transaction_on_insert();

with upd as (
  update public.cases c
  set
    status = 'pending_approval',
    last_activity = 'Pago verificado: pendiente de tu aprobación',
    last_activity_at = now()
  from public.transactions t
  where c.transaction_id = t.id
    and c.status = 'awaiting_payment'
    and t.status = 'approved'
  returning c.id, c.lawyer_id
)
insert into public.lawyer_notifications (lawyer_id, type, title, body, ref_id)
select
  u.lawyer_id,
  'new_case',
  'Nuevo caso pagado',
  'Revisa los detalles del caso para aceptar o rechazar la solicitud.',
  u.id
from upd u
where not exists (
  select 1
  from public.lawyer_notifications ln
  where ln.ref_id = u.id
    and ln.type = 'new_case'
);
