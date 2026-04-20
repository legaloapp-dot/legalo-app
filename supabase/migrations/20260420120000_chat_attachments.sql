-- LÉGALO APP - Attachments en mensajes de chat

-- Bucket para archivos adjuntos del chat
insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', false)
on conflict (id) do nothing;

-- Solo el dueño (carpeta = user_id) puede subir/leer/borrar sus archivos
create policy "Owner can upload chat attachments"
  on storage.objects for insert
  with check (
    bucket_id = 'chat-attachments'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Owner can read chat attachments"
  on storage.objects for select
  using (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Owner can delete chat attachments"
  on storage.objects for delete
  using (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Tabla de attachments vinculada a mensajes de conversación
create table public.conversation_attachments (
  id uuid primary key default uuid_generate_v4(),
  message_id uuid references public.conversation_messages(id) on delete cascade not null,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  file_size integer,
  created_at timestamp with time zone default now()
);

create index conversation_attachments_message_idx on public.conversation_attachments(message_id);
create index conversation_attachments_conv_idx on public.conversation_attachments(conversation_id);

alter table public.conversation_attachments enable row level security;

create policy "Users can view own conversation attachments"
  on public.conversation_attachments for select
  using (auth.uid() = user_id);

create policy "Users can insert own conversation attachments"
  on public.conversation_attachments for insert
  with check (auth.uid() = user_id);
