-- Harder-earned coins: every finished game pays a little, and the shop's prices are in four tiers.
--
--   win     1st place: 5 coins, +2 ranked, +3 full game (5 to 10), as before
--   play    any other place: 3 coins, +1 ranked, +1 full game (3 to 5)
--
-- Prices (about 20 coins a day for someone who plays ten games a day):
--   common 200-400 (1-2 weeks), rare 600-1000 (a month), epic 1500-2500 (2-3 months), legendary 4000-5000+ (5-6 months).

alter table public.coin_log drop constraint coin_log_reason_check;
alter table public.coin_log add constraint coin_log_reason_check check (reason in ('win', 'play', 'achievement'));

create or replace function public.pay_game_coins()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ranked boolean := new.kind = 'ranked';
  full_game boolean := new.format = 'full';
begin
  if new.place = 1 then
    perform public.grant_coins(
      new.user_id,
      5 + (case when ranked then 2 else 0 end) + (case when full_game then 3 else 0 end),
      'win', new.id::text, new.table_id
    );
  else
    perform public.grant_coins(
      new.user_id,
      3 + (case when ranked then 1 else 0 end) + (case when full_game then 1 else 0 end),
      'play', new.id::text, new.table_id
    );
  end if;
  perform public.grant_achievement_coins(new.user_id, new.table_id);
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Prices

update public.shop_items set price = v.price
from (values
  -- common
  ('blue', 200), ('purple', 200), ('graphite', 250),
  ('f_laurel', 250), ('f_gold', 350),
  ('n_gold', 300),
  ('e_cheer', 250), ('e_tilt', 250), ('e_talk', 400),
  -- rare
  ('crimson', 600), ('emerald', 600),
  ('suits', 700),
  ('f_neon', 700),
  ('n_frost', 600), ('n_neon', 700),
  -- epic
  ('neon', 1500), ('sakura', 1500), ('damask', 1800), ('frost', 2000), ('gilded', 2200), ('aurora', 2500),
  ('northern', 1500), ('embers', 1800),
  ('f_frost', 1800), ('f_flame', 2200),
  ('n_fire', 1800),
  ('w_sparks', 1500), ('w_confetti', 1800), ('w_gold', 2200),
  -- legendary
  ('obsidian', 4500), ('carbon', 5000), ('midnight', 5000),
  ('f_royal', 5000),
  ('n_rainbow', 5000),
  ('w_fire', 4500)
) as v(id, price)
where public.shop_items.id = v.id;

-- A new nickname costs 400 coins.
create or replace function public.change_nickname(p_name text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  clean text := btrim(coalesce(p_name, ''));
  price constant integer := 400;
  have integer;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if char_length(clean) not between 2 and 16 then
    raise exception 'bad nickname' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.profiles where lower(nickname) = lower(clean) and id <> uid) then
    raise exception 'nickname taken' using errcode = 'P0001';
  end if;

  select balance into have from public.player_coins where user_id = uid for update;
  if coalesce(have, 0) < price then
    raise exception 'not enough coins' using errcode = 'P0001';
  end if;

  perform set_config('app.nick_ok', '1', true);
  begin
    update public.profiles set nickname = clean where id = uid;
  exception when unique_violation then
    raise exception 'nickname taken' using errcode = 'P0001';
  end;
  update public.player_coins set balance = balance - price, updated_at = now() where user_id = uid;
  return have - price;
end;
$$;
