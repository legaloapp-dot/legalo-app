-- LÉGALO APP - Storage buckets
-- Comprobantes de pago y carnets de abogados

-- Bucket para comprobantes de pago (captures)
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- Bucket para carnets de Inpreabogado
insert into storage.buckets (id, name, public)
values ('lawyer-cards', 'lawyer-cards', false)
on conflict (id) do nothing;

-- Políticas: usuarios autenticados pueden subir
create policy "Authenticated can upload receipts"
  on storage.objects for insert
  with check (bucket_id = 'receipts' and auth.role() = 'authenticated');

create policy "Authenticated can upload lawyer cards"
  on storage.objects for insert
  with check (bucket_id = 'lawyer-cards' and auth.role() = 'authenticated');

-- Lectura: usuarios autenticados (RLS adicional por carpeta en app)
create policy "Authenticated can read receipts"
  on storage.objects for select
  using (bucket_id = 'receipts' and auth.role() = 'authenticated');

create policy "Authenticated can read lawyer cards"
  on storage.objects for select
  using (bucket_id = 'lawyer-cards' and auth.role() = 'authenticated');
