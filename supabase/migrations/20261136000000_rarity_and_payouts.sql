-- League-of-Legends-style rarity: standard / epic / legendary / ultimate / mythic.
-- Card backs cost 1200 / 2400 / 3600 / 4800 / 8000; frames, names, backgrounds and win effects 300 / 600 / 900 / 1300 / 2000;
-- reactions, throwables, sounds and play effects 100 / 200 / 300 / 450 / 700.
alter table public.shop_items add column if not exists rarity text not null default 'standard'
  check (rarity in ('standard', 'epic', 'legendary', 'ultimate', 'mythic'));

update public.shop_items s set rarity = v.rarity, price = v.price
from (values
  ('crimson', 'standard', 1200),
  ('damask', 'standard', 1200),
  ('emerald', 'epic', 2400),
  ('frost', 'epic', 2400),
  ('aurora', 'epic', 2400),
  ('gilded', 'legendary', 3600),
  ('sakura', 'legendary', 3600),
  ('neon', 'legendary', 3600),
  ('obsidian', 'ultimate', 4800),
  ('midnight', 'ultimate', 4800),
  ('carbon', 'ultimate', 4800),
  ('matrix', 'mythic', 8000),
  ('f_hex', 'standard', 300),
  ('f_octa', 'standard', 300),
  ('f_squircle', 'standard', 300),
  ('f_laurel', 'standard', 300),
  ('f_star', 'epic', 600),
  ('f_gold', 'epic', 600),
  ('f_seal', 'epic', 600),
  ('f_ice', 'epic', 600),
  ('f_neon', 'legendary', 900),
  ('f_sakura', 'legendary', 900),
  ('f_frost', 'legendary', 900),
  ('f_flame', 'legendary', 900),
  ('f_carbon', 'ultimate', 1300),
  ('f_moon', 'ultimate', 1300),
  ('f_royal', 'ultimate', 1300),
  ('f_matrix', 'mythic', 2000),
  ('n_terminal', 'standard', 300),
  ('n_chrome', 'standard', 300),
  ('n_glitch', 'standard', 300),
  ('n_ghost', 'standard', 300),
  ('n_gold', 'epic', 600),
  ('n_sparkle', 'epic', 600),
  ('n_frost', 'epic', 600),
  ('n_glacier', 'epic', 600),
  ('n_neon', 'legendary', 900),
  ('n_sakura', 'legendary', 900),
  ('n_fire', 'legendary', 900),
  ('n_carbon', 'ultimate', 1300),
  ('n_night', 'ultimate', 1300),
  ('n_rainbow', 'ultimate', 1300),
  ('n_matrix', 'mythic', 2000),
  ('blue', 'standard', 300),
  ('purple', 'standard', 300),
  ('graphite', 'standard', 300),
  ('dusk', 'standard', 300),
  ('bronze', 'standard', 300),
  ('suits', 'epic', 600),
  ('snow', 'epic', 600),
  ('waves', 'epic', 600),
  ('glacier', 'epic', 600),
  ('blossom', 'legendary', 900),
  ('stars', 'legendary', 900),
  ('northern', 'legendary', 900),
  ('embers', 'legendary', 900),
  ('carbonbg', 'ultimate', 1300),
  ('lullaby', 'ultimate', 1300),
  ('matrixbg', 'mythic', 2000),
  ('w_snow', 'standard', 300),
  ('w_hearts', 'standard', 300),
  ('w_coins', 'standard', 300),
  ('w_lightning', 'epic', 600),
  ('w_rainbow', 'epic', 600),
  ('w_sparks', 'epic', 600),
  ('w_ice', 'epic', 600),
  ('w_confetti', 'legendary', 900),
  ('w_gold', 'legendary', 900),
  ('w_sakura', 'legendary', 900),
  ('w_carbon', 'ultimate', 1300),
  ('w_night', 'ultimate', 1300),
  ('w_fire', 'ultimate', 1300),
  ('w_matrix', 'mythic', 2000),
  ('s_wood', 'standard', 100),
  ('s_soft', 'standard', 100),
  ('s_arcade', 'standard', 100),
  ('s_crystal', 'epic', 200),
  ('s_ice', 'epic', 200),
  ('s_sakura', 'legendary', 300),
  ('s_carbon', 'ultimate', 450),
  ('s_night', 'ultimate', 450),
  ('s_matrix', 'mythic', 700),
  ('r_bravo', 'standard', 100),
  ('r_hearts', 'standard', 100),
  ('r_fire', 'epic', 200),
  ('r_mic', 'epic', 200),
  ('r_flag', 'epic', 200),
  ('r_cold', 'epic', 200),
  ('r_fireworks', 'legendary', 300),
  ('r_petals', 'legendary', 300),
  ('r_moon', 'ultimate', 450),
  ('r_crown', 'ultimate', 450),
  ('r_pill', 'mythic', 700),
  ('t_rose', 'standard', 100),
  ('t_tomato', 'standard', 100),
  ('t_egg', 'standard', 100),
  ('t_snowball', 'epic', 200),
  ('t_pie', 'epic', 200),
  ('t_bouquet', 'legendary', 300),
  ('p_spark', 'standard', 100),
  ('p_frost', 'epic', 200),
  ('p_wave', 'epic', 200),
  ('p_shatter', 'epic', 200),
  ('p_fire', 'legendary', 300),
  ('p_sakura', 'legendary', 300),
  ('p_carbon', 'ultimate', 450),
  ('p_night', 'ultimate', 450),
  ('p_matrix', 'mythic', 700)
) as v(id, rarity, price)
where s.id = v.id;

-- the shop list now carries the rarity too
drop function if exists public.shop_stock();
create function public.shop_stock()
 returns table(id text, kind text, price integer, tier text, ends_at timestamp with time zone, rarity text)
 language sql
 stable
 set search_path to ''
as $function$
  with wk as (
    select date_trunc('week', now() at time zone 'utc') at time zone 'utc' as starts
  ),
  ranked as (
    select i.id,
           row_number() over (partition by i.kind order by md5(wk.starts::text || i.id)) as rn
    from public.shop_items i, wk
    where i.tier = 'rotating'
  )
  select i.id, i.kind, i.price, i.tier,
         case when i.tier = 'rotating' then (select starts + interval '7 days' from wk) end,
         i.rarity
  from public.shop_items i
  left join ranked r on r.id = i.id
  where i.tier = 'permanent'
     or r.rn <= (case i.kind when 'card_back' then 3 else 1 end)
  order by i.tier desc, i.kind, i.price, i.id;
$function$;
grant execute on function public.shop_stock() to anon, authenticated;

-- a pack costs 15% less than its parts added together (rounded to 100)
update public.shop_bundles b set price = greatest(100, round(0.85 * (
  select sum(i.price) from public.shop_bundle_items bi join public.shop_items i on i.id = bi.item_id where bi.bundle_id = b.id
) / 100.0) * 100);

-- coins: about twenty times more per game, so that 1200 coins take 7-8 wins
create or replace function public.pay_game_coins() returns trigger
 language plpgsql security definer set search_path to ''
as $function$
declare
  ranked boolean := new.kind = 'ranked';
  full_game boolean := new.format = 'full';
begin
  if new.place = 1 then
    perform public.grant_coins(
      new.user_id,
      100 + (case when ranked then 40 else 0 end) + (case when full_game then 60 else 0 end),
      'win', new.id::text, new.table_id
    );
  else
    perform public.grant_coins(
      new.user_id,
      30 + (case when ranked then 10 else 0 end) + (case when full_game then 10 else 0 end),
      'play', new.id::text, new.table_id
    );
  end if;
  perform public.grant_achievement_coins(new.user_id, new.table_id);
  return new;
end;
$function$;

-- one-off achievements x20
create or replace function public.grant_achievement_coins(p_user uuid, p_table uuid default null)
 returns void
 language plpgsql security definer set search_path to ''
as $function$
declare
  played integer;
  wins integer;
  best integer;
  streak integer;
  full_win boolean;
begin
  select count(*), count(*) filter (where place = 1), coalesce(max(score), 0),
         coalesce(bool_or(format = 'full' and place = 1), false)
    into played, wins, best, full_win
    from public.game_results where user_id = p_user and game = 'joker';

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

  if wins >= 1 then perform public.grant_coins(p_user, 100, 'achievement', 'first', p_table); end if;
  if played >= 10 then perform public.grant_coins(p_user, 100, 'achievement', 'ten', p_table); end if;
  if best >= 500 then perform public.grant_coins(p_user, 140, 'achievement', 'score', p_table); end if;
  if streak >= 3 then perform public.grant_coins(p_user, 160, 'achievement', 'streak', p_table); end if;
  if full_win then perform public.grant_coins(p_user, 200, 'achievement', 'full', p_table); end if;
end;
$function$;

-- invitations: 1000 for the new player, 1500 for the one who invited
create or replace function public.pay_referral() returns trigger
 language plpgsql security definer set search_path to ''
as $function$
declare
  r public.referrals;
  games integer;
begin
  if not new.online or new.kind not in ('friendly', 'ranked') then
    return new;
  end if;
  select * into r from public.referrals where invitee = new.user_id and rewarded_at is null for update;
  if not found then
    return new;
  end if;
  select count(*) into games from public.game_results
    where user_id = new.user_id and online and kind in ('friendly', 'ranked');
  if games < 3 then
    return new;
  end if;

  update public.referrals set rewarded_at = now() where invitee = r.invitee;
  perform public.grant_coins(r.invitee, 1000, 'invite', 'welcome');
  if (select count(*) from public.referrals where inviter = r.inviter and rewarded_at is not null) <= 10 then
    perform public.grant_coins(r.inviter, 1500, 'invite', r.invitee::text);
  end if;
  return new;
exception when others then
  return new;
end;
$function$;
