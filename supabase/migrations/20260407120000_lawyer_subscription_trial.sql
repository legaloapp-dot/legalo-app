-- Suscripción abogados: prueba 30 días al aprobar; plan trial → basic al vencer; premium = pagado

alter table public.profiles
  add column if not exists subscription_expires_at timestamptz;

alter table public.profiles
  add column if not exists plan text;

alter table public.profiles drop constraint if exists profiles_plan_check;
alter table public.profiles
  add constraint profiles_plan_check
  check (plan is null or plan in ('trial', 'premium', 'basic'));

comment on column public.profiles.subscription_expires_at is 'Fin del periodo de prueba (abogado verificado)';
comment on column public.profiles.plan is 'trial=prueba; premium=suscripción paga; basic=prueba vencida sin pago';

-- Al aprobar abogado: 30 días de prueba desde hoy
create or replace function public.profiles_on_lawyer_verified_trial()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'lawyer'
     and coalesce(old.is_verified, false) = false
     and new.is_verified = true
     and coalesce(old.plan, '') <> 'premium'
     and coalesce(new.plan, '') <> 'premium'
  then
    new.subscription_expires_at := (now() at time zone 'utc') + interval '30 days';
    new.plan := 'trial';
  end if;
  return new;
end;
$$;

drop trigger if exists tr_profiles_lawyer_verified_trial on public.profiles;
create trigger tr_profiles_lawyer_verified_trial
  before update of is_verified on public.profiles
  for each row
  execute function public.profiles_on_lawyer_verified_trial();

-- Abogados ya verificados sin fecha de prueba: ventana de 30 días desde la migración
update public.profiles
set
  subscription_expires_at = (now() at time zone 'utc') + interval '30 days',
  plan = 'trial'
where role = 'lawyer'
  and is_verified = true
  and subscription_expires_at is null;

update public.profiles
set plan = 'trial'
where role = 'lawyer'
  and is_verified = true
  and plan is null
  and subscription_expires_at is not null;

-- Expira prueba: pasa a basic (llamar desde la app al iniciar sesión)
create or replace function public.refresh_lawyer_subscription()
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
  set plan = 'basic'
  where id = auth.uid()
    and role = 'lawyer'
    and plan = 'trial'
    and subscription_expires_at is not null
    and subscription_expires_at < (now() at time zone 'utc');

end;
$$;

grant execute on function public.refresh_lawyer_subscription() to authenticated;
