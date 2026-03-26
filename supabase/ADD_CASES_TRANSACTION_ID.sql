-- Ejecutar en Supabase → SQL Editor si la app muestra:
-- PGRST204: Could not find the 'transaction_id' column of 'cases' in the schema cache
--
-- Requiere que exista public.transactions (tabla de pagos/comprobantes).

alter table public.cases
  add column if not exists transaction_id uuid references public.transactions(id) on delete set null;

create index if not exists cases_transaction_id_idx on public.cases (transaction_id);

-- Si al crear caso con estado awaiting_payment falla por CHECK, ejecuta también el bloque
-- «Estados de caso + flujo Flash» en EJECUTAR_EN_SUPABASE.sql (líneas ~354–421).
