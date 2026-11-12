-- Achievements: 42 of them, each paying coins and XP once, many tied to levels.
--
--   achievement_defs      the list: what is counted (metric), how much (target), and the reward
--   player_achievements   who earned what and when (public: a profile shows it)
--
-- Everything is worked out here, never in the browser. An achievement is checked after every finished game
-- (the coins trigger calls grant_achievements) and whenever a player opens their achievements
-- (my_achievements), which also catches what no game causes: friends, gifts, items, the city, levels.
-- The coins go through grant_coins (once per player and achievement) and the XP through add_xp.

create table if not exists public.achievement_defs (
  id text primary key,
  metric text not null,
  target integer not null check (target > 0),
  coins integer not null default 0 check (coins >= 0),
  xp integer not null default 0 check (xp >= 0),
  sort integer not null
);
alter table public.achievement_defs enable row level security;
drop policy if exists "achievements are visible to everyone" on public.achievement_defs;
create policy "achievements are visible to everyone" on public.achievement_defs for select to anon, authenticated using (true);

create table if not exists public.player_achievements (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null references public.achievement_defs (id) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, id)
);
alter table public.player_achievements enable row level security;
drop policy if exists "earned achievements are visible to everyone" on public.player_achievements;
create policy "earned achievements are visible to everyone" on public.player_achievements for select to anon, authenticated using (true);

insert into public.achievement_defs (id, metric, target, coins, xp, sort) values
  -- the first five were there before (their coins are already paid)
  ('first', 'joker_wins', 1, 100, 50, 10),
  ('ten', 'joker_played', 10, 100, 50, 20),
  ('score', 'joker_best', 500, 140, 80, 30),
  ('streak', 'joker_streak', 3, 160, 100, 40),
  ('full', 'joker_full_wins', 1, 200, 120, 50),
  -- games played
  ('p50', 'played', 50, 250, 100, 60),
  ('p100', 'played', 100, 500, 200, 70),
  ('p250', 'played', 250, 1000, 400, 80),
  ('p500', 'played', 500, 2000, 800, 90),
  -- wins
  ('w5', 'wins', 5, 200, 80, 100),
  ('w25', 'wins', 25, 600, 200, 110),
  ('w100', 'wins', 100, 2000, 600, 120),
  ('s5', 'joker_streak', 5, 500, 200, 130),
  ('pod10', 'podium', 10, 200, 80, 140),
  ('sc1000', 'joker_best', 1000, 400, 150, 150),
  -- online
  ('on1', 'online', 1, 100, 40, 160),
  ('on10', 'online', 10, 300, 120, 170),
  ('on50', 'online', 50, 800, 300, 180),
  ('rk1', 'ranked', 1, 100, 50, 190),
  ('rk10', 'ranked', 10, 400, 150, 200),
  -- bura and both games
  ('bw1', 'bura_wins', 1, 150, 60, 210),
  ('bw10', 'bura_wins', 10, 500, 200, 220),
  ('both', 'game_types', 2, 300, 100, 230),
  -- days played
  ('d7', 'days', 7, 300, 120, 240),
  ('d30', 'days', 30, 1000, 400, 250),
  -- ranks (best rating in any game)
  ('r_silver', 'rating_peak', 100, 300, 100, 260),
  ('r_gold', 'rating_peak', 150, 600, 200, 270),
  ('r_diamond', 'rating_peak', 350, 2000, 500, 280),
  ('r_master', 'rating_peak', 400, 3000, 800, 290),
  -- levels
  ('lv10', 'level', 10, 200, 100, 300),
  ('lv25', 'level', 25, 500, 200, 310),
  ('lv50', 'level', 50, 1000, 300, 320),
  ('lv75', 'level', 75, 2000, 400, 330),
  ('lv100', 'level', 100, 5000, 0, 340),
  -- the collection
  ('i5', 'items', 5, 150, 60, 350),
  ('i15', 'items', 15, 400, 150, 360),
  ('mythic', 'mythic', 1, 300, 120, 370),
  -- friends and the rest
  ('f1', 'friends', 1, 100, 40, 380),
  ('f5', 'friends', 5, 300, 120, 390),
  ('g1', 'gifts_sent', 1, 150, 60, 400),
  ('city', 'city', 1, 80, 30, 410),
  ('inv1', 'invited', 1, 300, 100, 420)
on conflict (id) do nothing;

-- gives XP (and the level frames a new level brings)
create or replace function public.add_xp(p_user uuid, p_gain integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_xp integer;
  after_xp integer;
begin
  if p_gain is null or p_gain <= 0 then
    return;
  end if;
  insert into public.player_xp (user_id, xp) values (p_user, 0) on conflict do nothing;
  select xp into before_xp from public.player_xp where user_id = p_user for update;
  after_xp := before_xp + p_gain;
  update public.player_xp set xp = after_xp, updated_at = now() where user_id = p_user;
  if public.level_of(after_xp) > public.level_of(before_xp) then
    perform public.grant_level_frames(p_user, public.level_of(after_xp));
  end if;
end;
$$;
revoke all on function public.add_xp(uuid, integer) from public, anon, authenticated;

-- the XP of a finished game now goes through add_xp
create or replace function public.award_xp() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  day date := (new.played_at at time zone 'Asia/Tbilisi')::date;
  gain integer;
begin
  if new.online then
    gain := (case when new.place = 1 then 40 else 20 end)
          + (case when new.kind = 'ranked' then 10 else 0 end)
          + (case when new.format = 'full' then 10 else 0 end);
    if new.place = 1 and not exists (
      select 1 from public.game_results r
      where r.user_id = new.user_id and r.online and r.place = 1 and r.id <> new.id
        and (r.played_at at time zone 'Asia/Tbilisi')::date = day
    ) then
      gain := gain + 50;
    end if;
  else
    if (select count(*) from public.game_results r
        where r.user_id = new.user_id and not r.online and (r.played_at at time zone 'Asia/Tbilisi')::date = day) > 10 then
      return new;
    end if;
    gain := case when new.place = 1 then 20 else 10 end;
  end if;
  perform public.add_xp(new.user_id, gain);
  return new;
exception when others then
  return new; -- a game result must never fail because of the XP
end;
$$;
revoke all on function public.award_xp() from public, anon, authenticated;

-- every figure the achievements count, for one player
create or replace function public.achievement_metrics(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  streak integer;
  out jsonb;
begin
  select coalesce(max(run), 0) into streak
  from (
    select count(*) as run
    from (
      select place,
             row_number() over (order by played_at, id)
             - row_number() over (partition by (place = 1) order by played_at, id) as grp
      from public.game_results where user_id = p_user and game = 'joker'
    ) g
    where place = 1
    group by grp
  ) runs;

  select jsonb_build_object(
    'joker_played', (select count(*) from public.game_results where user_id = p_user and game = 'joker'),
    'joker_wins', (select count(*) from public.game_results where user_id = p_user and game = 'joker' and place = 1),
    'joker_best', (select coalesce(max(score), 0) from public.game_results where user_id = p_user and game = 'joker'),
    'joker_streak', streak,
    'joker_full_wins', (select count(*) from public.game_results where user_id = p_user and game = 'joker' and format = 'full' and place = 1),
    'played', (select count(*) from public.game_results where user_id = p_user),
    'wins', (select count(*) from public.game_results where user_id = p_user and place = 1),
    'podium', (select count(*) from public.game_results where user_id = p_user and place <= 3),
    'online', (select count(*) from public.game_results where user_id = p_user and online),
    'ranked', (select count(*) from public.game_results where user_id = p_user and kind = 'ranked'),
    'bura_wins', (select count(*) from public.game_results where user_id = p_user and game = 'bura' and place = 1),
    'game_types', (select count(distinct game) from public.game_results where user_id = p_user),
    'days', (select count(distinct (played_at at time zone 'Asia/Tbilisi')::date) from public.game_results where user_id = p_user),
    'rating_peak', (select coalesce(max(peak), 0) from public.player_ratings where user_id = p_user),
    'level', public.level_of((select xp from public.player_xp where user_id = p_user)),
    'items', (select count(*) from public.user_items u join public.shop_items i on i.id = u.item_id where u.user_id = p_user and i.tier <> 'level'),
    'mythic', (select count(*) from public.user_items u join public.shop_items i on i.id = u.item_id where u.user_id = p_user and i.tier <> 'level' and i.rarity = 'mythic'),
    'friends', (select count(*) from public.friendships where status = 'accepted' and (requester = p_user or addressee = p_user)),
    'gifts_sent', (select count(*) from public.gifts where from_user = p_user),
    'city', (select case when city is not null then 1 else 0 end from public.profiles where id = p_user),
    'invited', (select count(*) from public.referrals where inviter = p_user and rewarded_at is not null)
  ) into out;
  return out;
end;
$$;
revoke all on function public.achievement_metrics(uuid) from public, anon, authenticated;

-- pays every achievement the player has reached and not been paid for; returns the ones just earned
create or replace function public.grant_achievements(p_user uuid, p_table uuid default null)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  metrics jsonb;
  d public.achievement_defs;
  fresh boolean;
  got integer;
  ids text[] := '{}';
  pass integer := 0;
begin
  -- XP from one achievement can bring the next (a level), so look again until nothing new comes
  loop
    pass := pass + 1;
    fresh := false;
    metrics := public.achievement_metrics(p_user);
    for d in
      select * from public.achievement_defs a
      where not exists (select 1 from public.player_achievements e where e.user_id = p_user and e.id = a.id)
      order by a.sort
    loop
      if coalesce((metrics ->> d.metric)::integer, 0) >= d.target then
        insert into public.player_achievements (user_id, id) values (p_user, d.id) on conflict do nothing;
        get diagnostics got = row_count;
        if got > 0 then
          fresh := true;
          ids := ids || d.id;
          if d.coins > 0 then
            perform public.grant_coins(p_user, d.coins, 'achievement', d.id, p_table);
          end if;
          perform public.add_xp(p_user, d.xp);
        end if;
      end if;
    end loop;
    exit when not fresh or pass >= 4;
  end loop;
  return ids;
end;
$$;
revoke all on function public.grant_achievements(uuid, uuid) from public, anon, authenticated;

-- the games call this (through the coins trigger) after every result
create or replace function public.grant_achievement_coins(p_user uuid, p_table uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.grant_achievements(p_user, p_table);
exception when others then
  null; -- a finished game must never fail because of an achievement
end;
$$;

-- what the player's own achievements page asks: pays what is due, then gives the figures and what is earned
create or replace function public.my_achievements()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  fresh text[];
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  fresh := public.grant_achievements(uid, null);
  return jsonb_build_object(
    'metrics', public.achievement_metrics(uid),
    'fresh', to_jsonb(fresh),
    'earned', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'at', e.earned_at) order by e.earned_at), '[]'::jsonb) from public.player_achievements e where e.user_id = uid)
  );
end;
$$;
revoke all on function public.my_achievements() from public, anon;
grant execute on function public.my_achievements() to authenticated;
