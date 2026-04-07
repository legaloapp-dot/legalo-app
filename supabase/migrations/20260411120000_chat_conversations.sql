-- LÉGALO APP - Conversaciones de chat persistentes

-- Tabla de conversaciones
create table public.conversations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null default 'Nueva consulta',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index conversations_user_id_idx on public.conversations(user_id);

-- Tabla de mensajes de conversacion
create table public.conversation_messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  role text not null check (role in ('user', 'ai')),
  content text not null,
  category text,
  show_actions boolean default false,
  created_at timestamp with time zone default now()
);

create index conversation_messages_conv_idx on public.conversation_messages(conversation_id, created_at);

-- Trigger: actualizar updated_at en conversacion al insertar mensaje
create or replace function public.update_conversation_updated_at()
returns trigger as $$
begin
  update public.conversations
  set updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_conversation_message_inserted
  after insert on public.conversation_messages
  for each row execute procedure public.update_conversation_updated_at();

-- RLS
alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;

create policy "Users can view own conversations"
  on public.conversations for select
  using (auth.uid() = user_id);

create policy "Users can insert own conversations"
  on public.conversations for insert
  with check (auth.uid() = user_id);

create policy "Users can update own conversations"
  on public.conversations for update
  using (auth.uid() = user_id);

create policy "Users can delete own conversations"
  on public.conversations for delete
  using (auth.uid() = user_id);

create policy "Users can view own conversation messages"
  on public.conversation_messages for select
  using (
    exists (
      select 1 from public.conversations
      where id = conversation_id and user_id = auth.uid()
    )
  );

create policy "Users can insert own conversation messages"
  on public.conversation_messages for insert
  with check (
    exists (
      select 1 from public.conversations
      where id = conversation_id and user_id = auth.uid()
    )
  );
