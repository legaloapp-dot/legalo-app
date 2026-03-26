-- Notas del abogado separadas del título/descripción del cliente
alter table public.cases add column if not exists lawyer_observations text;
