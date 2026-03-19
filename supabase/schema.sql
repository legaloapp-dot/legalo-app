-- LÉGALO APP - Esquema de Base de Datos (Supabase/PostgreSQL)
-- PRD MVP - Speed-to-Market

-- Habilitar extensión UUID si no existe
create extension if not exists "uuid-ossp";

-- Profiles: Extensión de auth.users
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  role text check (role in ('client', 'lawyer', 'admin')),
  phone text,
  is_verified boolean default false,
  specialty text,        -- Solo para abogados
  inpre_number text,     -- Solo para abogados
  created_at timestamp with time zone default now()
);

-- Transactions: Gestión de Escrow
create table transactions (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references profiles(id),
  lawyer_id uuid references profiles(id),
  amount decimal,
  status text check (status in ('pending', 'approved', 'rejected')) default 'pending',
  receipt_url text,      -- Link a Supabase Storage
  created_at timestamp with time zone default now()
);

-- RLS (Row Level Security) - Políticas básicas
alter table profiles enable row level security;
alter table transactions enable row level security;

-- Los usuarios pueden ver su propio perfil
create policy "Users can view own profile" on profiles
  for select using (auth.uid() = id);

-- Los usuarios pueden actualizar su propio perfil
create policy "Users can update own profile" on profiles
  for update using (auth.uid() = id);
