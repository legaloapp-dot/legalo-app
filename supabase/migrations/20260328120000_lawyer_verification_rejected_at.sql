-- Permite distinguir "pendiente de revisión" vs "rechazado por admin" (ambos con is_verified = false)
alter table public.profiles
  add column if not exists lawyer_verification_rejected_at timestamptz;

comment on column public.profiles.lawyer_verification_rejected_at is
  'Si no es null y is_verified es false, el admin rechazó la verificación.';
