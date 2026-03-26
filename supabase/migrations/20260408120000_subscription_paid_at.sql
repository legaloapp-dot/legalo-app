-- Fecha de último pago de suscripción (admin / reportes)

alter table public.profiles
  add column if not exists subscription_paid_at timestamptz;

comment on column public.profiles.subscription_paid_at is 'Fecha del último pago de suscripción abogado (registrada por admin)';
