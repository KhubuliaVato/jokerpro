-- Packs: a set of shop items sold together for less than the sum of their prices. The first one: Sakura.
--
--   shop_bundles / shop_bundle_items   what is in a pack, and its price
--   buy_bundle(p_bundle)               buys what the player does not own yet, for a share of the pack's price
--                                      (owning two of eight items takes two eighths, by price, off the cost)

-- the new Sakura items (the sakura card back already exists)
insert into public.shop_items (id, kind, price, tier) values
  ('blossom', 'theme', 1500, 'permanent'),
  ('f_sakura', 'frame', 2500, 'permanent'),
  ('n_sakura', 'name_style', 1800, 'permanent'),
  ('w_sakura', 'win_fx', 2500, 'permanent'),
  ('p_sakura', 'play_fx', 250, 'permanent'),
  ('s_sakura', 'sound_pack', 200, 'permanent'),
  ('r_petals', 'reaction', 200, 'permanent')
on conflict (id) do nothing;

create table public.shop_bundles (
  id text primary key,
  price integer not null check (price > 0),
  sort integer not null default 0
);

create table public.shop_bundle_items (
  bundle_id text not null references public.shop_bundles (id) on delete cascade,
  item_id text not null references public.shop_items (id) on delete cascade,
  primary key (bundle_id, item_id)
);

alter table public.shop_bundles enable row level security;
alter table public.shop_bundle_items enable row level security;
create policy "bundles are public" on public.shop_bundles for select to anon, authenticated using (true);
create policy "bundle items are public" on public.shop_bundle_items for select to anon, authenticated using (true);

insert into public.shop_bundles (id, price, sort) values ('b_sakura', 7500, 1);
insert into public.shop_bundle_items (bundle_id, item_id) values
  ('b_sakura', 'sakura'), ('b_sakura', 'blossom'), ('b_sakura', 'f_sakura'), ('b_sakura', 'n_sakura'),
  ('b_sakura', 'w_sakura'), ('b_sakura', 'p_sakura'), ('b_sakura', 's_sakura'), ('b_sakura', 'r_petals');

create function public.buy_bundle(p_bundle text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  bundle_price integer;
  total integer;
  missing integer;
  cost integer;
  have integer;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  select price into bundle_price from public.shop_bundles where id = p_bundle;
  if bundle_price is null then
    raise exception 'not in stock' using errcode = 'P0001';
  end if;

  select sum(i.price),
         coalesce(sum(i.price) filter (where not exists (
           select 1 from public.user_items u where u.user_id = uid and u.item_id = i.id)), 0)
    into total, missing
  from public.shop_bundle_items b join public.shop_items i on i.id = b.item_id
  where b.bundle_id = p_bundle;

  if missing = 0 then
    raise exception 'already owned' using errcode = 'P0001';
  end if;
  cost := round(bundle_price::numeric * missing / total);

  select balance into have from public.player_coins where user_id = uid for update;
  if coalesce(have, 0) < cost then
    raise exception 'not enough coins' using errcode = 'P0001';
  end if;

  update public.player_coins set balance = balance - cost, updated_at = now() where user_id = uid;
  insert into public.user_items (user_id, item_id, price)
  select uid, i.id, round(i.price::numeric * cost / missing)
  from public.shop_bundle_items b join public.shop_items i on i.id = b.item_id
  where b.bundle_id = p_bundle
    and not exists (select 1 from public.user_items u where u.user_id = uid and u.item_id = i.id);
  return have - cost;
end;
$$;

revoke execute on function public.buy_bundle(text) from public, anon;
grant execute on function public.buy_bundle(text) to authenticated;
