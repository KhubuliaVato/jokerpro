-- Player levels (1-100) and the level frames.
--
-- Every finished game gives experience (XP). The level is worked out from the XP (so the curve can be changed
-- later without touching any player): level L starts at 6*(L-1)*(L+10) XP, i.e. level 2 needs 72 XP and every
-- next level 12 XP more than the one before. Level 100 is the last one.
--
--   win 40, loss 20       (+10 in a ranked game, +10 in a full-length game)
--   against bots          half of it (20 / 10, nothing extra), only the first 10 such games of a day count
--   first online win of the day: +50
--
-- Levels 25, 50, 75 and 100 give a frame (tier 'level': never on sale, cannot be gifted).
-- XP is written only by the trigger below; a browser can read it (the level badge is public) but not change it.

create table if not exists public.player_xp (
  user_id uuid primary key references auth.users (id) on delete cascade,
  xp integer not null default 0 check (xp >= 0),
  updated_at timestamptz not null default now()
);
alter table public.player_xp enable row level security;
drop policy if exists "levels are visible to everyone" on public.player_xp;
create policy "levels are visible to everyone" on public.player_xp for select to anon, authenticated using (true);

-- level of an amount of XP
create or replace function public.level_of(p_xp integer)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  x integer := greatest(coalesce(p_xp, 0), 0);
  l integer := greatest(1, floor((-54 + sqrt(2916 + 24 * (x + 60))) / 12)::integer);
begin
  while l < 100 and 6 * l * (l + 11) <= x loop l := l + 1; end loop;
  while l > 1 and 6 * (l - 1) * (l + 10) > x loop l := l - 1; end loop;
  return least(l, 100);
end;
$$;
grant execute on function public.level_of(integer) to anon, authenticated;

-- the frames of the levels
alter table public.shop_items drop constraint if exists shop_items_tier_check;
alter table public.shop_items add constraint shop_items_tier_check check (tier in ('permanent', 'rotating', 'level'));
insert into public.shop_items (id, kind, price, tier, rarity) values
  ('f_lv25', 'frame', 1, 'level', 'epic'),
  ('f_lv50', 'frame', 1, 'level', 'legendary'),
  ('f_lv75', 'frame', 1, 'level', 'ultimate'),
  ('f_lv100', 'frame', 1, 'level', 'mythic')
on conflict (id) do nothing;

-- gives the frames of every level between two levels (frames of levels already passed are not given twice)
create or replace function public.grant_level_frames(p_user uuid, p_level integer)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.user_items (user_id, item_id, price)
  select p_user, i.id, 0
  from public.shop_items i
  where i.tier = 'level' and substr(i.id, 5)::integer <= p_level
  on conflict (user_id, item_id) do nothing;
$$;
revoke all on function public.grant_level_frames(uuid, integer) from public, anon, authenticated;

-- XP of a finished game
create or replace function public.award_xp() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  day date := (new.played_at at time zone 'Asia/Tbilisi')::date;
  gain integer;
  before_xp integer;
  after_xp integer;
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

  insert into public.player_xp (user_id, xp) values (new.user_id, 0) on conflict do nothing;
  select xp into before_xp from public.player_xp where user_id = new.user_id for update;
  after_xp := before_xp + gain;
  update public.player_xp set xp = after_xp, updated_at = now() where user_id = new.user_id;
  if public.level_of(after_xp) > public.level_of(before_xp) then
    perform public.grant_level_frames(new.user_id, public.level_of(after_xp));
  end if;
  return new;
exception when others then
  return new; -- a game result must never fail because of the XP
end;
$$;
revoke all on function public.award_xp() from public, anon, authenticated;

drop trigger if exists game_results_award_xp on public.game_results;
create trigger game_results_award_xp after insert on public.game_results
  for each row execute function public.award_xp();

-- players who have played already start with what their games would have given (no daily limits applied)
insert into public.player_xp (user_id, xp)
select user_id,
       sum(case when online then (case when place = 1 then 40 else 20 end) + (case when kind = 'ranked' then 10 else 0 end) + (case when format = 'full' then 10 else 0 end)
                else (case when place = 1 then 20 else 10 end) end)::integer
from public.game_results
group by user_id
on conflict (user_id) do nothing;

select public.grant_level_frames(user_id, public.level_of(xp)) from public.player_xp;

-- level frames are earned, not given away
create or replace function public.send_gift(p_to text, p_item text, p_message text default ''::text)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  uid uuid := (select auth.uid());
  target uuid;
  letter text := left(btrim(coalesce(p_message, '')), 300);
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  if exists (select 1 from public.shop_items where id = p_item and tier = 'level') then
    raise exception 'level items cannot be gifted' using errcode = 'P0001';
  end if;

  select id into target from public.profiles where lower(nickname) = lower(btrim(coalesce(p_to, '')));
  if target is null then
    raise exception 'no such player' using errcode = 'P0001';
  end if;
  if target = uid then
    raise exception 'cannot gift yourself' using errcode = 'P0001';
  end if;

  if (select count(*) from public.gifts where from_user = uid and created_at > now() - interval '1 day') >= 20 then
    raise exception 'too many gifts' using errcode = '54000';
  end if;

  perform 1 from public.user_items where user_id = uid and item_id = p_item for update;
  if not found then
    raise exception 'item not owned' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.user_items where user_id = target and item_id = p_item) then
    raise exception 'receiver already owns it' using errcode = 'P0001';
  end if;

  update public.profiles set
    equipped_back  = case when equipped_back  = p_item then null else equipped_back  end,
    equipped_frame = case when equipped_frame = p_item then null else equipped_frame end,
    equipped_name  = case when equipped_name  = p_item then null else equipped_name  end,
    equipped_fx    = case when equipped_fx    = p_item then null else equipped_fx    end
  where id = uid;

  update public.user_items set user_id = target, acquired_at = now()
  where user_id = uid and item_id = p_item;

  insert into public.gifts (from_user, to_user, item_id, message) values (uid, target, p_item, letter);
end;
$function$;
