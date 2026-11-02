-- The shop: card backs bought with coins, an inventory per player, and the one worn at the table.
--
--   shop_items   what can be bought (price and tier); the pictures and names live in the app
--   user_items   what each player owns (public: anybody can look at an inventory)
--
-- Two tiers: 'permanent' items are always on sale, 'rotating' ones come in four at a time and the
-- four change every Monday 00:00 UTC (picked from the date, so no job has to run).
-- Buying goes only through buy_item(); a browser cannot hand itself an item or coins.

create table public.shop_items (
  id text primary key,
  kind text not null default 'card_back' check (kind in ('card_back')),
  price integer not null check (price > 0),
  tier text not null check (tier in ('permanent', 'rotating'))
);

alter table public.shop_items enable row level security;

create policy "the shop is visible to everyone"
  on public.shop_items for select to anon, authenticated using (true);

create table public.user_items (
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id text not null references public.shop_items (id),
  price integer not null,
  acquired_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

alter table public.user_items enable row level security;

create policy "inventories are visible to everyone"
  on public.user_items for select to anon, authenticated using (true);

-- The card back a player puts on the table; everybody at the table sees it.
alter table public.profiles add column equipped_back text references public.shop_items (id);

-- A player can wear only what they own (the profile may otherwise be edited by its owner).
create function public.guard_equipped_back()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.equipped_back is not null
     and new.equipped_back is distinct from old.equipped_back
     and not exists (select 1 from public.user_items where user_id = new.id and item_id = new.equipped_back) then
    raise exception 'item not owned' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_equipped_back() from public, anon, authenticated;

create trigger profiles_guard_equipped_back
  before update of equipped_back on public.profiles
  for each row execute function public.guard_equipped_back();

-- ---------------------------------------------------------------------------------------------

insert into public.shop_items (id, price, tier) values
  ('crimson', 30, 'permanent'),
  ('emerald', 30, 'permanent'),
  ('midnight', 40, 'permanent'),
  ('gilded', 90, 'rotating'),
  ('neon', 60, 'rotating'),
  ('obsidian', 70, 'rotating'),
  ('sakura', 50, 'rotating'),
  ('aurora', 90, 'rotating'),
  ('carbon', 60, 'rotating'),
  ('damask', 75, 'rotating'),
  ('frost', 55, 'rotating');

-- What is on sale right now: every permanent item and this week's four rotating ones.
create function public.shop_stock()
returns table (id text, price integer, tier text, ends_at timestamptz)
language sql
stable
set search_path = ''
as $$
  with wk as (
    select date_trunc('week', now() at time zone 'utc') at time zone 'utc' as starts
  ),
  picked as (
    select i.id
    from public.shop_items i, wk
    where i.tier = 'rotating'
    order by md5(wk.starts::text || i.id)
    limit 4
  )
  select i.id, i.price, i.tier,
         case when i.tier = 'rotating' then (select starts + interval '7 days' from wk) end
  from public.shop_items i
  where i.tier = 'permanent' or i.id in (select id from picked)
  order by i.tier desc, i.price, i.id;
$$;

grant execute on function public.shop_stock() to anon, authenticated;

create function public.buy_item(p_item text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  cost integer;
  have integer;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  select s.price into cost from public.shop_stock() s where s.id = p_item;
  if cost is null then
    raise exception 'not in stock' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.user_items where user_id = uid and item_id = p_item) then
    raise exception 'already owned' using errcode = 'P0001';
  end if;

  select balance into have from public.player_coins where user_id = uid for update;
  if coalesce(have, 0) < cost then
    raise exception 'not enough coins' using errcode = 'P0001';
  end if;

  update public.player_coins set balance = balance - cost, updated_at = now() where user_id = uid;
  insert into public.user_items (user_id, item_id, price) values (uid, p_item, cost);
  return have - cost;
end;
$$;

revoke execute on function public.buy_item(text) from public, anon;
grant execute on function public.buy_item(text) to authenticated;
