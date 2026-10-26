-- Online play: private tables with a join code, four seats, and a server-owned game.
--
--   game_tables  one row per table (code, host, rules, status)
--   table_seats  who sits where
--   table_games  the FULL game state; only the Edge Function (service role) can touch it
--   table_views  one row per player with *their* view of the game (own hand only); players read it live
--
-- Players never write game rows directly: seating goes through the RPCs below, moves through the
-- `joker` Edge Function, which validates every move with the same engine the client uses.

create table public.game_tables (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'finished', 'closed')),
  rules jsonb not null,
  created_at timestamptz not null default now()
);

create table public.table_seats (
  table_id uuid not null references public.game_tables (id) on delete cascade,
  seat integer not null check (seat between 0 and 3),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- A bot plays the seat after its player left or timed out twice in a row.
  bot boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (table_id, seat),
  unique (table_id, user_id)
);

create table public.table_games (
  table_id uuid primary key references public.game_tables (id) on delete cascade,
  state jsonb not null,
  version integer not null default 1,
  -- consecutive timed-out turns per real seat, e.g. {"2": 1}
  afk jsonb not null default '{}'::jsonb,
  turn_deadline timestamptz,
  updated_at timestamptz not null default now()
);

create table public.table_views (
  table_id uuid not null references public.game_tables (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  seat integer not null,
  version integer not null,
  view jsonb not null,
  turn_deadline timestamptz,
  primary key (table_id, user_id)
);

alter table public.game_tables enable row level security;
alter table public.table_seats enable row level security;
alter table public.table_games enable row level security;
alter table public.table_views enable row level security;

create function public.is_table_member(p_table_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.table_seats s
    where s.table_id = p_table_id and s.user_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_table_member(uuid) from public, anon;
grant execute on function public.is_table_member(uuid) to authenticated;

create policy "members see their table"
  on public.game_tables for select to authenticated
  using (public.is_table_member(id));

create policy "members see the seats of their table"
  on public.table_seats for select to authenticated
  using (public.is_table_member(table_id));

create policy "players see only their own view"
  on public.table_views for select to authenticated
  using ((select auth.uid()) = user_id);

-- table_games: RLS on and no policy, so only the service role reads or writes the hidden hands.

-- Live updates for the lobby and the game screen. Full replica identity so deletes can be filtered by table.
alter table public.table_seats replica identity full;
alter publication supabase_realtime add table public.table_seats, public.game_tables, public.table_views;

-- ---------------------------------------------------------------------------------------------
-- RPCs

create function public.create_table(p_rules jsonb)
returns public.game_tables
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no 0/O, 1/I
  clean jsonb;
  t public.game_tables;
  c text;
  i int;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  -- Only known settings, with known values.
  clean := jsonb_build_object(
    'format', case when p_rules ->> 'format' = 'nine' then 'nine' else 'full' end,
    'khishti', case when (p_rules ->> 'khishti') in ('100', '200', '500') then (p_rules ->> 'khishti')::int else 200 end,
    'passScore', 50,
    'missPerTrick', 10,
    'pulkaPremium', coalesce((p_rules ->> 'pulkaPremium')::boolean, true)
  );

  loop
    c := '';
    for i in 1..6 loop
      c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    begin
      insert into public.game_tables (code, host_id, rules) values (c, uid, clean) returning * into t;
      exit;
    exception when unique_violation then
      null; -- code already used, draw another
    end;
  end loop;

  insert into public.table_seats (table_id, seat, user_id) values (t.id, 0, uid);
  return t;
end;
$$;

create function public.join_table(p_code text)
returns public.game_tables
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  t public.game_tables;
  s int;
  seated boolean := false;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  select * into t from public.game_tables where code = upper(btrim(p_code));
  if not found then
    raise exception 'table not found' using errcode = 'P0002';
  end if;

  -- Already sitting here (reconnecting): nothing to do.
  if exists (select 1 from public.table_seats where table_id = t.id and user_id = uid) then
    return t;
  end if;

  if t.status <> 'waiting' then
    raise exception 'game already started' using errcode = 'P0001';
  end if;

  for s in 0..3 loop
    begin
      insert into public.table_seats (table_id, seat, user_id) values (t.id, s, uid);
      seated := true;
      exit;
    exception when unique_violation then
      null; -- seat taken (or a racing double join), try the next one
    end;
  end loop;

  if not seated then
    raise exception 'table is full' using errcode = 'P0001';
  end if;
  return t;
end;
$$;

create function public.leave_table(p_table_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  t public.game_tables;
  heir uuid;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  select * into t from public.game_tables where id = p_table_id;
  if not found then
    return;
  end if;

  if t.status = 'waiting' then
    delete from public.table_seats where table_id = t.id and user_id = uid;
    select user_id into heir from public.table_seats where table_id = t.id order by seat limit 1;
    if heir is null then
      update public.game_tables set status = 'closed' where id = t.id;
    elsif t.host_id = uid then
      update public.game_tables set host_id = heir where id = t.id;
    end if;
  elsif t.status = 'playing' then
    -- The game goes on: a bot takes the seat.
    update public.table_seats set bot = true where table_id = t.id and user_id = uid;
    if not exists (select 1 from public.table_seats where table_id = t.id and not bot) then
      update public.game_tables set status = 'closed' where id = t.id;
    end if;
  end if;
end;
$$;

revoke execute on function public.create_table(jsonb), public.join_table(text), public.leave_table(uuid) from public, anon;
grant execute on function public.create_table(jsonb), public.join_table(text), public.leave_table(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Results of online games

alter table public.game_results
  add column online boolean not null default false,
  add column players text[],
  add column table_id uuid references public.game_tables (id) on delete set null;

-- One result per player per table, however many times the server tries to save it (solo games have no table: NULLs never clash).
alter table public.game_results add constraint game_results_table_user_key unique (table_id, user_id);
