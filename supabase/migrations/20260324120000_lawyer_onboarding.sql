-- Onboarding abogado: datos perfil profesional y pasos 1–4
-- lawyer_onboarding_step: 0 = cliente / no aplica, 1–4 = paso actual, 5 = completado

alter table public.profiles
  add column if not exists years_experience integer,
  add column if not exists professional_bio text,
  add column if not exists specialty_other text,
  add column if not exists lawyer_onboarding_step integer default 0;

alter table public.profiles drop constraint if exists profiles_lawyer_onboarding_step_check;
alter table public.profiles add constraint profiles_lawyer_onboarding_step_check
  check (lawyer_onboarding_step is null or (lawyer_onboarding_step >= 0 and lawyer_onboarding_step <= 5));

-- Abogados ya existentes: no forzar onboarding
update public.profiles
set lawyer_onboarding_step = 5
where role = 'lawyer' and (lawyer_onboarding_step is null or lawyer_onboarding_step = 0);

-- Clientes explícitos en 0
update public.profiles
set lawyer_onboarding_step = 0
where role = 'client';

create or replace function public.handle_new_user()
returns trigger as $$
declare
  r text;
begin
  r := coalesce(new.raw_user_meta_data->>'role', 'client');
  insert into public.profiles (id, full_name, role, lawyer_onboarding_step)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    r,
    case when r = 'lawyer' then 1 else 0 end
  );
  return new;
end;
$$ language plpgsql security definer;
