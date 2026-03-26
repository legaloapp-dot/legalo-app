-- Notificación al abogado cuando el cliente finaliza el caso y deja calificación

alter table public.lawyer_notifications drop constraint if exists lawyer_notifications_type_check;

alter table public.lawyer_notifications
  add constraint lawyer_notifications_type_check
  check (type in (
    'account_approved',
    'new_case',
    'new_lead',
    'case_rated'
  ));

create or replace function public.notify_lawyer_on_case_rated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stars int;
  v_title text;
  v_body text;
begin
  if tg_op = 'UPDATE'
     and old.status = 'active'
     and new.status = 'closed'
     and old.client_rating is null
     and new.client_rating is not null
     and new.client_rating between 1 and 5
  then
    v_stars := new.client_rating;
    v_title := 'Caso finalizado y calificado';
    v_body :=
      'El cliente cerró el caso «'
      || left(trim(coalesce(new.title, 'Sin título')), 120)
      || '» con '
      || v_stars::text
      || case when v_stars = 1 then ' estrella' else ' estrellas' end
      || '.'
      || case
           when new.client_rating_comment is not null
                and length(trim(new.client_rating_comment)) > 0
           then ' Comentario: ' || left(trim(new.client_rating_comment), 300)
           else ''
         end;

    insert into public.lawyer_notifications (lawyer_id, type, title, body, ref_id)
    values (new.lawyer_id, 'case_rated', v_title, v_body, new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists tr_cases_notify_lawyer_rated on public.cases;
create trigger tr_cases_notify_lawyer_rated
  after update on public.cases
  for each row
  execute function public.notify_lawyer_on_case_rated();
