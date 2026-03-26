-- Notificaciones in-app para abogados (aprobación cuenta, nuevo caso, nuevo lead)

create table if not exists public.lawyer_notifications (
  id uuid primary key default gen_random_uuid(),
  lawyer_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('account_approved', 'new_case', 'new_lead')),
  title text not null,
  body text,
  ref_id uuid,
  read_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists lawyer_notifications_lawyer_created_idx
  on public.lawyer_notifications (lawyer_id, created_at desc);

alter table public.lawyer_notifications enable row level security;

drop policy if exists "Lawyers read own notifications" on public.lawyer_notifications;
create policy "Lawyers read own notifications"
  on public.lawyer_notifications for select
  using (auth.uid() = lawyer_id);

drop policy if exists "Lawyers update own notifications" on public.lawyer_notifications;
create policy "Lawyers update own notifications"
  on public.lawyer_notifications for update
  using (auth.uid() = lawyer_id);

-- Aprobación de cuenta (admin pone is_verified = true)
create or replace function public.notify_lawyer_on_verification()
returns trigger as $$
begin
  if new.role = 'lawyer'
     and coalesce(old.is_verified, false) = false
     and new.is_verified = true then
    insert into public.lawyer_notifications (lawyer_id, type, title, body)
    values (
      new.id,
      'account_approved',
      'Cuenta verificada',
      'Tu perfil de abogado fue aprobado. Ya puedes usar la app con todas las funciones.'
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists tr_profiles_lawyer_verified_notify on public.profiles;
create trigger tr_profiles_lawyer_verified_notify
  after update of is_verified on public.profiles
  for each row
  execute function public.notify_lawyer_on_verification();

-- Cliente crea un caso formal (tabla cases)
create or replace function public.notify_lawyer_on_new_case()
returns trigger as $$
begin
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

drop trigger if exists tr_cases_notify_lawyer on public.cases;
create trigger tr_cases_notify_lawyer
  after insert on public.cases
  for each row
  execute function public.notify_lawyer_on_new_case();

-- Lead / solicitud de contacto (tabla leads)
create or replace function public.notify_lawyer_on_new_lead()
returns trigger as $$
begin
  insert into public.lawyer_notifications (lawyer_id, type, title, body, ref_id)
  values (
    new.lawyer_id,
    'new_lead',
    'Nueva solicitud de contacto',
    trim(
      coalesce(new.client_name, 'Un cliente')
      || ' te envió una consulta'
      || case when new.category is not null and length(trim(new.category)) > 0
         then ' · ' || trim(new.category) else '' end
    ),
    new.id
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists tr_leads_notify_lawyer on public.leads;
create trigger tr_leads_notify_lawyer
  after insert on public.leads
  for each row
  execute function public.notify_lawyer_on_new_lead();
