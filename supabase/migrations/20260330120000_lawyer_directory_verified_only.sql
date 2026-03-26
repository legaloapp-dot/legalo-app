-- Directorio público para clientes: solo abogados con cuenta aprobada (is_verified)

drop policy if exists "Authenticated users can view lawyer directory" on public.profiles;

create policy "Authenticated users can view lawyer directory"
  on public.profiles for select
  using (
    role = 'lawyer'
    and coalesce(is_verified, false) = true
    and auth.uid() is not null
  );
