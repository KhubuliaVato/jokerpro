-- The paid emote/phrase packs go (phrases can be typed, emoji are free). In their place:
--
--   reaction     big animated stickers everybody at the table sees        (sent as chat "::r:<id>")
--   throwable    things you throw at another player's seat                (sent as chat "::t:<id>.<seat>")
--   play_fx      the effect of a card of yours landing on the table      (worn: profiles.equipped_play)
--   sound_pack   the sound of the cards, heard by the one who wears it   (worn: profiles.equipped_sound)

-- ---------------------------------------------------------------------------------------------
-- Refund the old packs (what each player paid), then remove them.

alter table public.coin_log drop constraint coin_log_reason_check;
alter table public.coin_log add constraint coin_log_reason_check
  check (reason in ('win', 'play', 'achievement', 'invite', 'refund'));

do $$
declare
  r record;
begin
  for r in
    select u.user_id, u.item_id, u.price from public.user_items u
    join public.shop_items i on i.id = u.item_id where i.kind = 'emote_pack'
  loop
    if r.price > 0 then
      perform public.grant_coins(r.user_id, r.price, 'refund', r.item_id);
    end if;
  end loop;
end $$;

delete from public.gifts where item_id in (select id from public.shop_items where kind = 'emote_pack');
delete from public.user_items where item_id in (select id from public.shop_items where kind = 'emote_pack');
delete from public.shop_items where kind = 'emote_pack';

alter table public.shop_items drop constraint shop_items_kind_check;
alter table public.shop_items add constraint shop_items_kind_check
  check (kind in ('card_back', 'theme', 'frame', 'name_style', 'win_fx', 'reaction', 'throwable', 'play_fx', 'sound_pack'));

-- ---------------------------------------------------------------------------------------------

alter table public.profiles
  add column equipped_play text references public.shop_items (id),
  add column equipped_sound text references public.shop_items (id);

create or replace function public.guard_profile()
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
    ('card_back', 'equipped_back'), ('frame', 'equipped_frame'), ('name_style', 'equipped_name'), ('win_fx', 'equipped_fx'),
    ('play_fx', 'equipped_play'), ('sound_pack', 'equipped_sound')
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

-- Whoever loses an item (a gift, an admin taking it away) stops wearing it.
create function public.unwear_lost_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set
    equipped_back = case when equipped_back = old.item_id then null else equipped_back end,
    equipped_frame = case when equipped_frame = old.item_id then null else equipped_frame end,
    equipped_name = case when equipped_name = old.item_id then null else equipped_name end,
    equipped_fx = case when equipped_fx = old.item_id then null else equipped_fx end,
    equipped_play = case when equipped_play = old.item_id then null else equipped_play end,
    equipped_sound = case when equipped_sound = old.item_id then null else equipped_sound end
  where id = old.user_id;
  return null;
end;
$$;

revoke execute on function public.unwear_lost_item() from public, anon, authenticated;

create trigger user_items_unwear
  after delete or update of user_id on public.user_items
  for each row execute function public.unwear_lost_item();

-- ---------------------------------------------------------------------------------------------

insert into public.shop_items (id, kind, price, tier) values
  ('r_bravo', 'reaction', 100, 'permanent'),
  ('r_hearts', 'reaction', 100, 'permanent'),
  ('r_fire', 'reaction', 150, 'permanent'),
  ('r_mic', 'reaction', 150, 'permanent'),
  ('r_fireworks', 'reaction', 200, 'permanent'),
  ('r_crown', 'reaction', 250, 'permanent'),
  ('t_rose', 'throwable', 60, 'permanent'),
  ('t_tomato', 'throwable', 60, 'permanent'),
  ('t_egg', 'throwable', 60, 'permanent'),
  ('t_snowball', 'throwable', 80, 'permanent'),
  ('t_pie', 'throwable', 100, 'permanent'),
  ('t_bouquet', 'throwable', 100, 'permanent'),
  ('p_spark', 'play_fx', 150, 'permanent'),
  ('p_frost', 'play_fx', 200, 'permanent'),
  ('p_wave', 'play_fx', 200, 'permanent'),
  ('p_fire', 'play_fx', 250, 'permanent'),
  ('s_wood', 'sound_pack', 120, 'permanent'),
  ('s_soft', 'sound_pack', 120, 'permanent'),
  ('s_arcade', 'sound_pack', 150, 'permanent'),
  ('s_crystal', 'sound_pack', 200, 'permanent');

-- ---------------------------------------------------------------------------------------------
-- Chat: "::r:<id>" is a reaction, "::t:<id>.<seat>" a thrown item; both must be owned.

create or replace function public.send_table_message(p_table_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  clean text := btrim(regexp_replace(coalesce(p_body, ''), '\s+', ' ', 'g'));
  item text;
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
    if clean ~ '^::r:[a-z_]+$' then
      item := substring(clean from '^::r:([a-z_]+)$');
    elsif clean ~ '^::t:[a-z_]+\.[0-3]$' then
      item := substring(clean from '^::t:([a-z_]+)\.');
    else
      raise exception 'bad emote' using errcode = 'P0001';
    end if;
    if not exists (
      select 1 from public.user_items u join public.shop_items i on i.id = u.item_id
      where u.user_id = uid and u.item_id = item and i.kind in ('reaction', 'throwable')
    ) then
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
