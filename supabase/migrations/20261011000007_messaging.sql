-- Pillow Thief :: conversations and messages
-- Conversations are bound to a booking and exactly two participants
-- (client + provider). Access is enforced by RLS on every read/write.

create table public.conversations (
  id           uuid primary key default extensions.uuid_generate_v4(),
  booking_id   uuid references public.bookings (id) on delete cascade,
  client_id    uuid not null references public.profiles (id) on delete cascade,
  provider_id  uuid not null references public.profiles (id) on delete cascade,
  last_message_at timestamptz,
  last_message_preview text,
  created_at   timestamptz not null default now(),
  unique (booking_id),
  check (client_id <> provider_id)
);

create index conversations_client_idx   on public.conversations (client_id, last_message_at desc nulls last);
create index conversations_provider_idx on public.conversations (provider_id, last_message_at desc nulls last);

create table public.messages (
  id              uuid primary key default extensions.uuid_generate_v4(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null references public.profiles (id) on delete cascade,
  body            text not null check (char_length(body) between 1 and 2000),
  -- system = booking status message, not user authored
  kind            text not null default 'text' check (kind in ('text', 'system')),
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index messages_conversation_idx on public.messages (conversation_id, created_at);

-- Update the conversation preview when a message is inserted.
create or replace function public.handle_new_message()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.conversations
     set last_message_at = new.created_at,
         last_message_preview = left(new.body, 120)
   where id = new.conversation_id;
  return new;
end;
$$;

create trigger on_new_message
after insert on public.messages
for each row execute function public.handle_new_message();

-- Realtime broadcast of messages to subscribed participants.
alter publication supabase_realtime add table public.messages;
