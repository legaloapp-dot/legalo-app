-- LÉGALO APP - Directorio de abogados
-- Permite a usuarios autenticados ver perfiles de abogados para matchmaking

create policy "Authenticated users can view lawyer directory"
  on public.profiles for select
  using (role = 'lawyer' and auth.uid() is not null);
