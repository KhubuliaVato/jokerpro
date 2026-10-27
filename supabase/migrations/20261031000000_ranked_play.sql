-- Ranked and friendly matches with random players, ratings, and the leaderboard.
--
--   kinds of table:  private (code, friends)  friendly (random players, no rating)  ranked (random players, rating)
--   player_ratings   current rating per player and game (written only by the game server)
--   rating_log       the server's private record of every rating change (nobody can read it)

alter table public.game_tables
  add column kind text not null default 'private' check (kind in ('private', 'friendly', 'ranked'));

-- Players waiting in a public lobby ping every few seconds; silent seats are given up.
alter table public.table_seats add column last_seen timestamptz not null default now();

create table public.player_ratings (
  user_id uuid not null references auth.users (id) on delete cascade,
  game text not null default 'joker',
  rating integer not null default 50 check (rating >= 0),
  games integer not null default 0,
  wins integer not null default 0,
  peak integer not null default 50,
  updated_at timestamptz not null default now(),
  primary key (user_id, game)
);

create index player_ratings_board_idx on public.player_ratings (game, rating desc, games desc);

alter table public.player_ratings enable row level security;

-- Ratings are public (leaderboard, profiles); only the server writes them.
create policy "ratings are visible to everyone"
  on public.player_ratings for select to anon, authenticated using (true);

create table public.rating_log (
  id uuid primary key default gen_random_uuid(),
  table_id uuid references public.game_tables (id) on delete set null,
  user_id uuid not null references auth.users (id) on delete cascade,
  game text not null,
  rating_before integer not null,
  rating_after integer not null,
  delta integer not null,
  detail jsonb,
  created_at timestamptz not null default now()
);

alter table public.rating_log enable row level security; -- no policy: server only

alter table public.game_results
  add column kind text,
  add column rating_before integer,
  add column rating_after integer;

-- Results now come only from the game server; a browser can no longer write (or forge) them.
drop policy "players save their own results" on public.game_results;

-- ---------------------------------------------------------------------------------------------
-- Joining a public table

create function public.find_table(p_kind text, p_format text)
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
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if p_kind not in ('ranked', 'friendly') or p_format not in ('nine', 'full') then
    raise exception 'bad request' using errcode = 'P0001';
  end if;

  -- One lobby at a time, and everybody asking for the same kind of table is handled one after another,
  -- so two players never end up alone at two tables.
  perform pg_advisory_xact_lock(hashtext('find_table:' || p_kind || ':' || p_format));

  delete from public.table_seats s
    using public.game_tables g
    where s.table_id = g.id
      and g.status = 'waiting'
      and ((g.kind <> 'private' and s.last_seen < now() - interval '40 seconds')
           or (g.kind <> 'private' and s.user_id = uid));
  update public.game_tables g set status = 'closed'
    where g.status = 'waiting' and not exists (select 1 from public.table_seats s where s.table_id = g.id);

  select coalesce((select rating from public.player_ratings where user_id = uid and game = 'joker'), 50)
    into my_rating;

  -- A ranked table takes players of similar rating; the longer it waits, the wider the range.
  select g.* into t
  from public.game_tables g
  where g.status = 'waiting'
    and g.kind = p_kind
    and g.rules ->> 'format' = p_format
    and (select count(*) from public.table_seats s where s.table_id = g.id) < 4
    and (
      p_kind <> 'ranked'
      or abs(
        coalesce((
          select avg(coalesce(pr.rating, 50))
          from public.table_seats s
          left join public.player_ratings pr on pr.user_id = s.user_id and pr.game = 'joker'
          where s.table_id = g.id
        ), 50) - my_rating
      ) <= 100 + extract(epoch from (now() - g.created_at)) * 5
    )
  order by g.created_at
  limit 1;

  if found then
    for s in 0..3 loop
      begin
        insert into public.table_seats (table_id, seat, user_id) values (t.id, s, uid);
        seated := true;
        exit;
      exception when unique_violation then
        null; -- seat taken, try the next one
      end;
    end loop;
    if seated then
      return t;
    end if;
  end if;

  -- Nothing suitable: open a new table and wait for others.
  loop
    c := '';
    for i in 1..6 loop
      c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    begin
      insert into public.game_tables (code, host_id, kind, rules)
      values (
        c, uid, p_kind,
        jsonb_build_object('format', p_format, 'khishti', 200, 'passScore', 50, 'missPerTrick', 10, 'pulkaPremium', true)
      )
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

-- "I am still here" from a waiting lobby.
create function public.table_ping(p_table_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.table_seats set last_seen = now()
  where table_id = p_table_id and user_id = (select auth.uid());
$$;

-- Codes open only private tables; random-player tables are entered with find_table.
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

  for s in 0..3 loop
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

revoke execute on function public.find_table(text, text), public.table_ping(uuid) from public, anon;
grant execute on function public.find_table(text, text), public.table_ping(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Leaderboard

create function public.get_leaderboard(p_game text default 'joker', p_limit integer default 100)
returns table (
  pos bigint,
  user_id uuid,
  nickname text,
  avatar_color text,
  avatar_icon text,
  avatar_url text,
  rating integer,
  games integer,
  wins integer
)
language sql
stable
set search_path = ''
as $$
  select
    rank() over (order by r.rating desc, r.wins desc, r.games asc) as pos,
    r.user_id, p.nickname, p.avatar_color, p.avatar_icon, p.avatar_url, r.rating, r.games, r.wins
  from public.player_ratings r
  join public.profiles p on p.id = r.user_id
  where r.game = p_game and r.games > 0
  order by pos, p.nickname
  limit least(greatest(p_limit, 1), 200);
$$;

-- Where a player stands (1 = best); null if they have not played a ranked game.
create function public.get_my_position(p_game text default 'joker')
returns bigint
language sql
stable
set search_path = ''
as $$
  select 1 + count(*)
  from public.player_ratings o, public.player_ratings me
  where me.user_id = (select auth.uid()) and me.game = p_game and me.games > 0
    and o.game = p_game and o.games > 0
    and (o.rating > me.rating or (o.rating = me.rating and o.wins > me.wins)
         or (o.rating = me.rating and o.wins = me.wins and o.games < me.games))
  having count(*) >= 0 and exists (select 1 from public.player_ratings m where m.user_id = (select auth.uid()) and m.game = p_game and m.games > 0);
$$;

grant execute on function public.get_leaderboard(text, integer), public.get_my_position(text) to anon, authenticated;

-- (follow-up) any player's place, replacing get_my_position
create function public.get_position(p_user uuid, p_game text default 'joker')
returns bigint
language sql
stable
set search_path = ''
as $$
  select 1 + count(*)
  from public.player_ratings o, public.player_ratings me
  where me.user_id = p_user and me.game = p_game and me.games > 0
    and o.game = p_game and o.games > 0
    and (o.rating > me.rating or (o.rating = me.rating and o.wins > me.wins)
         or (o.rating = me.rating and o.wins = me.wins and o.games < me.games))
  having exists (select 1 from public.player_ratings m where m.user_id = p_user and m.game = p_game and m.games > 0);
$$;

drop function public.get_my_position(text);
grant execute on function public.get_position(uuid, text) to anon, authenticated;
