-- Rutas en bucket `lawyer-cards` (privado) para verificación paso 2
alter table public.profiles
  add column if not exists lawyer_inpre_card_path text,
  add column if not exists lawyer_cedula_path text;
