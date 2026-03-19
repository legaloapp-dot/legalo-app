-- LÉGALO APP - Migración inicial
-- PRD MVP - Speed-to-Market

-- Extensión UUID
create extension if not exists "uuid-ossp";

-- Tabla profiles (extensión de auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  role text check (role in ('client', 'lawyer', 'admin')),
  phone text,
  is_verified boolean default false,
  specialty text,
  inpre_number text,
  created_at timestamp with time zone default now()
);

-- Tabla transactions (escrow)
create table public.transactions (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references public.profiles(id),
  lawyer_id uuid references public.profiles(id),
  amount decimal,
  status text check (status in ('pending', 'approved', 'rejected')) default 'pending',
  receipt_url text,
  created_at timestamp with time zone default now()
);

-- Trigger: crear perfil automáticamente al registrarse
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
