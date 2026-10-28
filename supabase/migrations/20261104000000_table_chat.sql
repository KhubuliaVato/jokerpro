-- Table chat: a few short messages between the players of one table.
--
-- Players read the messages of their own table (and follow them live), but never write the table directly:
-- sending goes through `send_table_message`, which checks the seat, trims and limits the text and the pace.
-- When the game is over (finished / closed) the messages of the table are deleted.

create table public.table_messages (
  id bigint generated always as identity primary key,
  table_id uuid not null references public.game_tables (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 200),
  created_at timestamptz not null default now()
);

create index table_messages_table_idx on public.table_messages (table_id, id);

alter table public.table_messages enable row level security;

create policy "members read the chat of their table"
  on public.table_messages for select to authenticated
  using (public.is_table_member(table_id));

-- No insert / update / delete policy: only the function below (and the cleanup trigger) write.

alter publication supabase_realtime add table public.table_messages;

create function public.send_table_message(p_table_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  clean text := btrim(regexp_replace(coalesce(p_body, ''), '\s+', ' ', 'g'));
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if not public.is_table_member(p_table_id) then
    raise exception 'not seated' using errcode = '42501';
  end if;
  if clean = '' then
    return;
  end if;
  if exists (select 1 from public.game_tables g where g.id = p_table_id and g.status in ('finished', 'closed')) then
    return;
  end if;
  -- At most 6 messages in 10 seconds per player.
  if (select count(*) from public.table_messages m
      where m.table_id = p_table_id and m.user_id = uid and m.created_at > now() - interval '10 seconds') >= 6 then
    raise exception 'too many messages' using errcode = '54000';
  end if;
  insert into public.table_messages (table_id, user_id, body) values (p_table_id, uid, left(clean, 200));
end;
$$;

revoke execute on function public.send_table_message(uuid, text) from public, anon;
grant execute on function public.send_table_message(uuid, text) to authenticated;

-- The game is over: the chat goes away with it.
create function public.clear_table_chat()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('finished', 'closed') and old.status is distinct from new.status then
    delete from public.table_messages where table_id = new.id;
  end if;
  return new;
end;
$$;

revoke execute on function public.clear_table_chat() from public, anon, authenticated;

create trigger game_tables_clear_chat
  after update of status on public.game_tables
  for each row execute function public.clear_table_chat();
