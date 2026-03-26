-- Calificación del cliente al finalizar caso + protección: el cliente no edita título/desc/obs. del abogado tras aprobación

alter table public.cases add column if not exists client_rating smallint
  check (client_rating is null or (client_rating >= 1 and client_rating <= 5));
alter table public.cases add column if not exists client_rating_comment text;
alter table public.cases add column if not exists client_rating_at timestamptz;

-- Cliente no puede editar campos del abogado ni título/desc tras fase inicial; solo cerrar con calificación desde active
create or replace function public.cases_client_update_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and auth.uid() = new.lawyer_id then
    return new;
  end if;

  if auth.uid() is null or auth.uid() is distinct from new.client_id then
    return new;
  end if;

  if new.lawyer_observations is distinct from old.lawyer_observations then
    raise exception 'No puedes editar las observaciones del abogado.';
  end if;

  if old.status not in ('awaiting_payment', 'pending_approval') then
    if new.title is distinct from old.title or new.description is distinct from old.description then
      raise exception 'No puedes editar el título o la descripción tras la aprobación del abogado.';
    end if;
  end if;

  if new.status is distinct from old.status then
    if old.status = 'active' and new.status = 'closed' and new.client_rating is not null
       and new.client_rating between 1 and 5 then
      return new;
    end if;
    raise exception 'No puedes cambiar el estado del caso manualmente.';
  end if;

  return new;
end;
$$;

drop trigger if exists tr_cases_client_guard on public.cases;
create trigger tr_cases_client_guard
  before update on public.cases
  for each row
  execute function public.cases_client_update_guard();

-- Finalizar caso activo con calificación (actualiza media del abogado)
create or replace function public.finalize_client_case(
  p_case_id uuid,
  p_stars int,
  p_comment text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lawyer uuid;
  v_avg numeric;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.';
  end if;
  if p_stars < 1 or p_stars > 5 then
    raise exception 'La calificación debe ser entre 1 y 5.';
  end if;

  update public.cases
  set
    status = 'closed',
    client_rating = p_stars,
    client_rating_comment = nullif(trim(p_comment), ''),
    client_rating_at = now(),
    last_activity = 'Caso finalizado por el cliente',
    last_activity_at = now()
  where id = p_case_id
    and client_id = auth.uid()
    and status = 'active'
    and client_rating is null
  returning lawyer_id into v_lawyer;

  if v_lawyer is null then
    raise exception 'No se puede finalizar este caso (debe estar activo y sin calificar).';
  end if;

  select round(avg(client_rating)::numeric, 2) into v_avg
  from public.cases
  where lawyer_id = v_lawyer and client_rating is not null;

  update public.profiles
  set professional_rating = v_avg
  where id = v_lawyer;
end;
$$;

grant execute on function public.finalize_client_case(uuid, int, text) to authenticated;
