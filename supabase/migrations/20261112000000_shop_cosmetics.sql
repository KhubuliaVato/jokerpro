-- More of the shop: avatar frames, name styles, win effects, emote packs, and a paid nickname change.
--
--   profiles.equipped_frame / equipped_name / equipped_fx   what the player wears (everybody at the table sees it)
--   emote packs have nothing to wear: owning one lets the player send its emotes and phrases in the table chat
--   change_nickname(p_name)                                  the only way to change a nickname (costs coins)

alter table public.shop_items drop constraint shop_items_kind_check;
alter table public.shop_items add constraint shop_items_kind_check
  check (kind in ('card_back', 'theme', 'frame', 'name_style', 'win_fx', 'emote_pack'));

alter table public.profiles
  add column equipped_frame text references public.shop_items (id),
  add column equipped_name text references public.shop_items (id),
  add column equipped_fx text references public.shop_items (id);

-- One guard for everything a player may wear (only what they own, and of the right kind), and for the nickname.
drop trigger profiles_guard_equipped_back on public.profiles;
drop function public.guard_equipped_back();

create function public.guard_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  slot record;
  wanted text;
begin
  for slot in select * from (values
    ('card_back', 'equipped_back'), ('frame', 'equipped_frame'), ('name_style', 'equipped_name'), ('win_fx', 'equipped_fx')
  ) as s(kind, col)
  loop
    wanted := to_jsonb(new) ->> slot.col;
    if wanted is not null and wanted is distinct from (to_jsonb(old) ->> slot.col) then
      if not exists (
        select 1 from public.user_items u join public.shop_items i on i.id = u.item_id
        where u.user_id = new.id and u.item_id = wanted and i.kind = slot.kind
      ) then
        raise exception 'item not owned' using errcode = 'P0001';
      end if;
    end if;
  end loop;

  if new.nickname is distinct from old.nickname and coalesce(current_setting('app.nick_ok', true), '') <> '1' then
    raise exception 'nickname change is a shop service' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_profile() from public, anon, authenticated;

create trigger profiles_guard
  before update on public.profiles
  for each row execute function public.guard_profile();

-- ---------------------------------------------------------------------------------------------

insert into public.shop_items (id, kind, price, tier) values
  ('f_laurel', 'frame', 100, 'permanent'),
  ('f_gold', 'frame', 120, 'permanent'),
  ('f_neon', 'frame', 150, 'permanent'),
  ('f_frost', 'frame', 200, 'permanent'),
  ('f_flame', 'frame', 200, 'permanent'),
  ('f_royal', 'frame', 250, 'permanent'),
  ('n_gold', 'name_style', 100, 'permanent'),
  ('n_neon', 'name_style', 150, 'permanent'),
  ('n_frost', 'name_style', 150, 'permanent'),
  ('n_fire', 'name_style', 180, 'permanent'),
  ('n_rainbow', 'name_style', 250, 'permanent'),
  ('w_sparks', 'win_fx', 150, 'permanent'),
  ('w_gold', 'win_fx', 200, 'permanent'),
  ('w_confetti', 'win_fx', 200, 'permanent'),
  ('w_fire', 'win_fx', 250, 'permanent'),
  ('e_cheer', 'emote_pack', 80, 'permanent'),
  ('e_tilt', 'emote_pack', 80, 'permanent'),
  ('e_talk', 'emote_pack', 120, 'permanent');

-- ---------------------------------------------------------------------------------------------
-- Chat: emotes and phrases are sent as "::e:<pack>.<n>" / "::p:<pack>.<n>"; the basic pack is free, the others must be owned.

create or replace function public.send_table_message(p_table_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  clean text := btrim(regexp_replace(coalesce(p_body, ''), '\s+', ' ', 'g'));
  pack text;
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

  if left(clean, 2) = '::' then
    if clean !~ '^::[ep]:[a-z_]+\.[0-9]{1,2}$' then
      raise exception 'bad emote' using errcode = 'P0001';
    end if;
    pack := substring(clean from '^::[ep]:([a-z_]+)\.');
    if pack <> 'basic' and not exists (select 1 from public.user_items where user_id = uid and item_id = 'e_' || pack) then
      raise exception 'item not owned' using errcode = 'P0001';
    end if;
  end if;

  -- At most 6 messages in 10 seconds per player.
  if (select count(*) from public.table_messages m
      where m.table_id = p_table_id and m.user_id = uid and m.created_at > now() - interval '10 seconds') >= 6 then
    raise exception 'too many messages' using errcode = '54000';
  end if;
  insert into public.table_messages (table_id, user_id, body) values (p_table_id, uid, left(clean, 200));
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- A new nickname costs 150 coins.

create function public.change_nickname(p_name text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  clean text := btrim(coalesce(p_name, ''));
  price constant integer := 150;
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

revoke execute on function public.change_nickname(text) from public, anon;
grant execute on function public.change_nickname(text) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- The leaderboard shows frames and name styles too.

drop function public.get_leaderboard(text, integer);

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
  wins integer,
  equipped_frame text,
  equipped_name text
)
language sql
stable
set search_path = ''
as $$
  select
    rank() over (order by r.rating desc, r.wins desc, r.games asc) as pos,
    r.user_id, p.nickname, p.avatar_color, p.avatar_icon, p.avatar_url, r.rating, r.games, r.wins,
    p.equipped_frame, p.equipped_name
  from public.player_ratings r
  join public.profiles p on p.id = r.user_id
  where r.game = p_game and r.games > 0
  order by pos, p.nickname
  limit least(greatest(p_limit, 1), 200);
$$;

grant execute on function public.get_leaderboard(text, integer) to anon, authenticated;
