-- Online Bura. Tables get a `game` ("joker" or "bura") and a number of seats (rules.players, four when absent).
--   Bura rules: {"game": "bura", "format": "p2" | "p4", "players": 2 | 4}
-- Everything that used to assume four seats now asks for the table's capacity.

alter table public.game_tables
  add column game text not null default 'joker' check (game in ('joker', 'bura'));

create function public.table_capacity(p_rules jsonb)
returns integer
language sql
immutable
set search_path = ''
as $$ select coalesce((p_rules ->> 'players')::int, 4); $$;

-- ---------------------------------------------------------------------------------------------
-- Private tables

create or replace function public.create_table(p_rules jsonb)
returns public.game_tables
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no 0/O, 1/I
  clean jsonb;
  g text := case when p_rules ->> 'game' = 'bura' then 'bura' else 'joker' end;
  n int;
  t public.game_tables;
  c text;
  i int;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  update public.game_tables set status = 'closed'
    where status = 'waiting' and created_at < now() - interval '3 hours';
  delete from public.table_seats s
    using public.game_tables gt
    where s.table_id = gt.id and gt.status = 'waiting' and s.user_id = uid;
  update public.game_tables gt set status = 'closed'
    where gt.status = 'waiting' and not exists (select 1 from public.table_seats s where s.table_id = gt.id);

  -- Only known settings, with known values.
  if g = 'bura' then
    n := case when (p_rules ->> 'players') = '4' then 4 else 2 end;
    clean := jsonb_build_object('game', 'bura', 'format', 'p' || n, 'players', n);
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
      null; -- code already used, draw another
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

  if exists (select 1 from public.table_seats where table_id = t.id and user_id = uid) then
    return t;
  end if;

  if t.kind <> 'private' then
    raise exception 'table not found' using errcode = 'P0002';
  end if;
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

-- ---------------------------------------------------------------------------------------------
-- Random players

drop function public.find_table(text, text);

create function public.find_table(p_kind text, p_format text, p_game text default 'joker')
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

revoke execute on function public.find_table(text, text, text) from public, anon;
grant execute on function public.find_table(text, text, text) to authenticated;

-- The ready check opens when the last seat of the table is taken.
create or replace function public.ready_check_open()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.game_tables g set ready_at = now()
  where g.id = new.table_id and g.kind <> 'private' and g.status = 'waiting'
    and (select count(*) from public.table_seats s where s.table_id = g.id) = public.table_capacity(g.rules);
  return new;
end;
$$;
