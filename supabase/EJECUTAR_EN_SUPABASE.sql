-- ============================================
-- LÉGALO APP - Ejecutar en Supabase SQL Editor
-- Copia todo y pega en: https://supabase.com/dashboard/project/qufazyzesquubkmrhyfk/sql
-- Luego haz clic en "Run"
-- ============================================

-- 1. Extensión UUID
create extension if not exists "uuid-ossp";

-- 2. Tabla profiles
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  role text check (role in ('client', 'lawyer', 'admin')),
  phone text,
  is_verified boolean default false,
  specialty text,
  inpre_number text,
  created_at timestamp with time zone default now()
);

-- 3. Tabla transactions
create table if not exists public.transactions (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references public.profiles(id),
  lawyer_id uuid references public.profiles(id),
  amount decimal,
  status text check (status in ('pending', 'approved', 'rejected')) default 'pending',
  receipt_url text,
  created_at timestamp with time zone default now()
);

-- 4. Trigger: crear perfil al registrarse
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'client')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 5. RLS en profiles
alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- 6. RLS en transactions
alter table public.transactions enable row level security;

drop policy if exists "Clients can view own transactions" on public.transactions;
create policy "Clients can view own transactions" on public.transactions for select using (auth.uid() = client_id);

drop policy if exists "Lawyers can view assigned transactions" on public.transactions;
create policy "Lawyers can view assigned transactions" on public.transactions for select using (auth.uid() = lawyer_id);

drop policy if exists "Clients can create transactions" on public.transactions;
create policy "Clients can create transactions" on public.transactions for insert with check (auth.uid() = client_id);

-- 7. Storage buckets
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('lawyer-cards', 'lawyer-cards', false)
on conflict (id) do nothing;

-- 8. Políticas Storage
drop policy if exists "Authenticated can upload receipts" on storage.objects;
create policy "Authenticated can upload receipts" on storage.objects for insert
  with check (bucket_id = 'receipts' and auth.role() = 'authenticated');

drop policy if exists "Authenticated can upload lawyer cards" on storage.objects;
create policy "Authenticated can upload lawyer cards" on storage.objects for insert
  with check (bucket_id = 'lawyer-cards' and auth.role() = 'authenticated');

drop policy if exists "Authenticated can read receipts" on storage.objects;
create policy "Authenticated can read receipts" on storage.objects for select
  using (bucket_id = 'receipts' and auth.role() = 'authenticated');

drop policy if exists "Authenticated can read lawyer cards" on storage.objects;
create policy "Authenticated can read lawyer cards" on storage.objects for select
  using (bucket_id = 'lawyer-cards' and auth.role() = 'authenticated');
