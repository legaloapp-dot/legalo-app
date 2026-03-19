-- LÉGALO APP - Políticas RLS

-- Habilitar RLS
alter table public.profiles enable row level security;
alter table public.transactions enable row level security;

-- Profiles: usuarios ven y actualizan su propio perfil
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Transactions: clientes ven sus transacciones
create policy "Clients can view own transactions"
  on public.transactions for select
  using (auth.uid() = client_id);

-- Transactions: abogados ven transacciones donde están asignados
create policy "Lawyers can view assigned transactions"
  on public.transactions for select
  using (auth.uid() = lawyer_id);

-- Transactions: clientes pueden crear (al hacer checkout)
create policy "Clients can create transactions"
  on public.transactions for insert
  with check (auth.uid() = client_id);

-- Transactions: admins pueden ver todo y actualizar (aprobar/rechazar)
-- Nota: los admins se manejan via service_role en el panel Next.js
