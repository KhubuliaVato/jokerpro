-- Joker skins: the joker is the main card, so its looks are sold apart from the decks.
do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'public.shop_items'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%card_back%';
  if c is not null then execute format('alter table public.shop_items drop constraint %I', c); end if;
end $$;
alter table public.shop_items add constraint shop_items_kind_check
  check (kind in ('card_back', 'theme', 'frame', 'name_style', 'win_fx', 'reaction', 'throwable', 'play_fx', 'sound_pack', 'joker_skin'));

alter table public.profiles add column if not exists equipped_joker text;
grant update (equipped_joker) on public.profiles to authenticated;

create or replace function public.guard_profile() returns trigger
 language plpgsql security definer set search_path to ''
as $function$
declare
  slot record;
  wanted text;
begin
  for slot in select * from (values
    ('card_back', 'equipped_back'), ('frame', 'equipped_frame'), ('name_style', 'equipped_name'), ('win_fx', 'equipped_fx'),
    ('play_fx', 'equipped_play'), ('sound_pack', 'equipped_sound'), ('joker_skin', 'equipped_joker')
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
$function$;

create or replace function public.unwear_lost_item() returns trigger
 language plpgsql security definer set search_path to ''
as $function$
begin
  update public.profiles set
    equipped_back = case when equipped_back = old.item_id then null else equipped_back end,
    equipped_frame = case when equipped_frame = old.item_id then null else equipped_frame end,
    equipped_name = case when equipped_name = old.item_id then null else equipped_name end,
    equipped_fx = case when equipped_fx = old.item_id then null else equipped_fx end,
    equipped_play = case when equipped_play = old.item_id then null else equipped_play end,
    equipped_sound = case when equipped_sound = old.item_id then null else equipped_sound end,
    equipped_joker = case when equipped_joker = old.item_id then null else equipped_joker end
  where id = old.user_id;
  return null;
end;
$function$;

insert into public.shop_items (id, kind, price, tier, rarity) values
  ('j_classic', 'joker_skin', 600, 'permanent', 'standard'),
  ('j_ice', 'joker_skin', 1200, 'permanent', 'epic'),
  ('j_sakura', 'joker_skin', 1800, 'permanent', 'legendary'),
  ('j_gilded', 'joker_skin', 1800, 'permanent', 'legendary'),
  ('j_carbon', 'joker_skin', 2400, 'permanent', 'ultimate'),
  ('j_night', 'joker_skin', 2400, 'permanent', 'ultimate'),
  ('j_matrix', 'joker_skin', 4000, 'permanent', 'mythic')
on conflict (id) do nothing;

-- each pack gets its own joker
insert into public.shop_bundle_items (bundle_id, item_id) values
  ('b_sakura', 'j_sakura'), ('b_carbon', 'j_carbon'), ('b_ice', 'j_ice'), ('b_night', 'j_night'), ('b_matrix', 'j_matrix')
on conflict do nothing;

update public.shop_bundles b set price = greatest(100, round(0.85 * (
  select sum(i.price) from public.shop_bundle_items bi join public.shop_items i on i.id = bi.item_id where bi.bundle_id = b.id
) / 100.0) * 100);
