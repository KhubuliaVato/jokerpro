-- Background colours of the site join the shop: wine and green stay free, the rest are bought once
-- (the choice itself stays in the player's browser, as before).

alter table public.shop_items drop constraint shop_items_kind_check;
alter table public.shop_items add constraint shop_items_kind_check check (kind in ('card_back', 'theme'));

insert into public.shop_items (id, kind, price, tier) values
  ('blue', 'theme', 50, 'permanent'),
  ('purple', 'theme', 50, 'permanent'),
  ('graphite', 'theme', 60, 'permanent');

-- shop_stock now says what kind each item is
drop function public.shop_stock();

create function public.shop_stock()
returns table (id text, kind text, price integer, tier text, ends_at timestamptz)
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
  select i.id, i.kind, i.price, i.tier,
         case when i.tier = 'rotating' then (select starts + interval '7 days' from wk) end
  from public.shop_items i
  where i.tier = 'permanent' or i.id in (select id from picked)
  order by i.tier desc, i.kind, i.price, i.id;
$$;

grant execute on function public.shop_stock() to anon, authenticated;
