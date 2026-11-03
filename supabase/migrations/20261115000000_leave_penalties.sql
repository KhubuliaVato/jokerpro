-- Leaving a running game costs something, and the seat can be taken back for a while.
--
--   * A player who leaves (or is kicked for missing two turns) of a ranked or friendly game is banned from
--     every new table for 2 hours; a ranked game also costs rating points (6 to 10, more the earlier it was),
--     which the game server applies when the game ends.
--   * For 7 minutes after leaving the player can return to the seat (the Edge Function `joker`, action
--     "return"): the ban is lifted and only half of the rating penalty remains. A seat can be won back once.
--   * Seats keep when and at which move of the game they were left, so the penalty can be worked out.

alter table public.table_seats
  add column left_at timestamptz,
  add column left_version integer,
  add column returned boolean not null default false;

create table public.play_bans (
  user_id uuid primary key references auth.users (id) on delete cascade,
  until timestamptz not null,
  -- until when the seat can still be taken back (null: it cannot)
  return_until timestamptz,
  table_id uuid references public.game_tables (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.play_bans enable row level security;

create policy "players see their own ban"
  on public.play_bans for select to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------------------------
-- Internal helpers (not callable from the browser)

-- A bot takes the seat of a player who left; ranked and friendly games also ban the player.
create function public.abandon_seat(p_table uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.game_tables;
  ver integer;
  had_returned boolean;
begin
  select * into t from public.game_tables where id = p_table;
  if not found or t.status <> 'playing' then
    return;
  end if;
  select version into ver from public.table_games where table_id = p_table;

  update public.table_seats
    set bot = true, left_at = now(), left_version = coalesce(ver, 0)
    where table_id = p_table and user_id = p_user and not bot
    returning returned into had_returned;
  if not found then
    return;
  end if;

  if t.kind in ('ranked', 'friendly') then
    insert into public.play_bans (user_id, until, return_until, table_id)
    values (
      p_user,
      now() + interval '2 hours' + (case when had_returned then interval '0' else interval '7 minutes' end),
      case when had_returned then null else now() + interval '7 minutes' end,
      p_table
    )
    on conflict (user_id) do update
      set until = excluded.until, return_until = excluded.return_until, table_id = excluded.table_id, created_at = now();
  end if;
end;
$$;

create function public.assert_not_banned(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  b timestamptz;
begin
  select until into b from public.play_bans where user_id = p_user and until > now();
  if b is not null then
    raise exception 'play ban until %', to_char(b at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') using errcode = 'P0001';
  end if;
end;
$$;

-- Games nobody can come back to any more (only bots left at the table) are closed.
create function public.close_abandoned_tables()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.game_tables g set status = 'closed'
  where g.status = 'playing'
    and not exists (
      select 1 from public.table_seats s
      where s.table_id = g.id
        and (not s.bot or (s.left_at > now() - interval '7 minutes' and not s.returned))
    );
$$;

revoke execute on function public.abandon_seat(uuid, uuid), public.assert_not_banned(uuid), public.close_abandoned_tables()
  from public, anon, authenticated;
grant execute on function public.abandon_seat(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------------------------
-- Entering a table is refused during the ban; leaving a running game goes through abandon_seat.

create or replace function public.create_table(p_rules jsonb)
returns public.game_tables
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  clean jsonb;
  g text := case p_rules ->> 'game' when 'bura' then 'bura' when 'poker' then 'poker' else 'joker' end;
  n int;
  big int;
  t public.game_tables;
  c text;
  i int;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  perform public.assert_not_banned(uid);

  update public.game_tables set status = 'closed'
    where status = 'waiting' and created_at < now() - interval '3 hours';
  delete from public.table_seats s
    using public.game_tables gt
    where s.table_id = gt.id and gt.status = 'waiting' and s.user_id = uid;
  update public.game_tables gt set status = 'closed'
    where gt.status = 'waiting' and not exists (select 1 from public.table_seats s where s.table_id = gt.id);
  perform public.close_abandoned_tables();

  if g = 'bura' then
    n := case when (p_rules ->> 'players') = '4' then 4 else 2 end;
    clean := jsonb_build_object('game', 'bura', 'format', 'p' || n, 'players', n);
  elsif g = 'poker' then
    n := case when (p_rules ->> 'players') in ('2', '3', '4', '5', '6') then (p_rules ->> 'players')::int else 6 end;
    big := case when (p_rules ->> 'bigBlind') in ('10', '20', '50') then (p_rules ->> 'bigBlind')::int else 20 end;
    clean := jsonb_build_object(
      'game', 'poker',
      'format', 'p' || n,
      'players', n,
      'smallBlind', big / 2,
      'bigBlind', big,
      'startStack', big * 50
    );
  else
    clean := jsonb_build_object(
      'format', case when p_rules ->> 'format' = 'nine' then 'nine' else 'full' end,
      'khishti', case when (p_rules ->> 'khishti') in ('100', '200', '500') then (p_rules ->> 'khishti')::int else 200 end,
      'passScore', 50,
      'missPerTrick', 10,
      'pulkaPremium', coalesce((p_rules ->> 'pulkaPremium')::boolean, true)
    );
  end if;

  loop
    c := '';
    for i in 1..6 loop
      c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    begin
      insert into public.game_tables (code, host_id, rules, game) values (c, uid, clean, g) returning * into t;
      exit;
    exception when unique_violation then
      null;
    end;
  end loop;

  insert into public.table_seats (table_id, seat, user_id) values (t.id, 0, uid);
  return t;
end;
$$;

create or replace function public.find_table(p_kind text, p_format text, p_game text default 'joker')
returns public.game_tables
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  my_rating int;
  t public.game_tables;
  s int;
  i int;
  c text;
  seated boolean := false;
  new_rules jsonb;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if p_kind not in ('ranked', 'friendly')
     or not ((p_game = 'joker' and p_format in ('nine', 'full')) or (p_game = 'bura' and p_format in ('p2', 'p4'))) then
    raise exception 'bad request' using errcode = 'P0001';
  end if;
  perform public.assert_not_banned(uid);
  if exists (
    select 1 from public.table_seats s join public.game_tables g on g.id = s.table_id
    where s.user_id = uid and not s.bot and g.status = 'playing'
  ) then
    raise exception 'already in a game' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext('find_table:' || p_game || ':' || p_kind || ':' || p_format));

  delete from public.table_seats s
    using public.game_tables g
    where s.table_id = g.id
      and g.status = 'waiting'
      and ((g.kind <> 'private' and s.last_seen < now() - interval '40 seconds')
           or (g.kind <> 'private' and s.user_id = uid));
  update public.game_tables g set status = 'closed'
    where g.status = 'waiting' and not exists (select 1 from public.table_seats s where s.table_id = g.id);
  perform public.close_abandoned_tables();

  select coalesce((select rating from public.player_ratings where user_id = uid and game = p_game), 50)
    into my_rating;

  select g.* into t
  from public.game_tables g
  where g.status = 'waiting'
    and g.game = p_game
    and g.kind = p_kind
    and g.rules ->> 'format' = p_format
    and (select count(*) from public.table_seats s where s.table_id = g.id) < public.table_capacity(g.rules)
    and (
      p_kind <> 'ranked'
      or abs(
        coalesce((
          select avg(coalesce(pr.rating, 50))
          from public.table_seats s
          left join public.player_ratings pr on pr.user_id = s.user_id and pr.game = p_game
          where s.table_id = g.id
        ), 50) - my_rating
      ) <= 100 + extract(epoch from (now() - g.created_at)) * 5
    )
  order by g.created_at
  limit 1;

  if found then
    for s in 0..public.table_capacity(t.rules) - 1 loop
      begin
        insert into public.table_seats (table_id, seat, user_id) values (t.id, s, uid);
        seated := true;
        exit;
      exception when unique_violation then
        null;
      end;
    end loop;
    if seated then
      return t;
    end if;
  end if;

  new_rules := case
    when p_game = 'bura' then
      jsonb_build_object('game', 'bura', 'format', p_format, 'players', case when p_format = 'p4' then 4 else 2 end)
    else
      jsonb_build_object('format', p_format, 'khishti', 200, 'passScore', 50, 'missPerTrick', 10, 'pulkaPremium', true)
  end;

  loop
    c := '';
    for i in 1..6 loop
      c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    begin
      insert into public.game_tables (code, host_id, kind, rules, game)
      values (c, uid, p_kind, new_rules, p_game)
      returning * into t;
      exit;
    exception when unique_violation then
      null;
    end;
  end loop;
  insert into public.table_seats (table_id, seat, user_id) values (t.id, 0, uid);
  return t;
end;
$$;

create or replace function public.join_table(p_code text)
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

  -- Already sitting here (reconnecting, or coming back to a seat a bot holds): nothing to do.
  if exists (select 1 from public.table_seats where table_id = t.id and user_id = uid) then
    return t;
  end if;

  if t.kind <> 'private' then
    raise exception 'table not found' using errcode = 'P0002';
  end if;
  perform public.assert_not_banned(uid);
  if t.status <> 'waiting' then
    raise exception 'game already started' using errcode = 'P0001';
  end if;

  for s in 0..public.table_capacity(t.rules) - 1 loop
    begin
      insert into public.table_seats (table_id, seat, user_id) values (t.id, s, uid);
      seated := true;
      exit;
    exception when unique_violation then
      null;
    end;
  end loop;

  if not seated then
    raise exception 'table is full' using errcode = 'P0001';
  end if;
  return t;
end;
$$;

create or replace function public.leave_table(p_table_id uuid)
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
    -- The game goes on: a bot takes the seat, and the seat can be taken back for 7 minutes.
    perform public.abandon_seat(t.id, uid);
  end if;
end;
$$;

-- The running game this player left less than 7 minutes ago and can still return to.
create function public.my_returnable_table()
returns public.game_tables
language sql
stable
security definer
set search_path = ''
as $$
  select g.*
  from public.game_tables g
  join public.table_seats s on s.table_id = g.id
  where s.user_id = (select auth.uid()) and s.bot and not s.returned
    and s.left_at > now() - interval '7 minutes' and g.status = 'playing'
  order by s.left_at desc
  limit 1;
$$;

revoke execute on function public.my_returnable_table() from public, anon;
grant execute on function public.my_returnable_table() to authenticated;
