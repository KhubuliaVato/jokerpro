-- The week's exclusives now come from every kind of item, not only the decks.
--
-- Permanent items are always on sale (the side columns of the shop). Rotating items are the exclusives: every Monday
-- 00:00 UTC the shop picks 3 decks and 1 each of frames, name styles, win effects and backgrounds from their pools.

update public.shop_items set tier = 'rotating'
  where id in ('f_frost', 'f_flame', 'f_royal', 'n_fire', 'n_rainbow', 'w_gold', 'w_fire', 'northern', 'embers');

create or replace function public.shop_stock()
returns table (id text, kind text, price integer, tier text, ends_at timestamptz)
language sql
stable
set search_path = ''
as $$
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
         case when i.tier = 'rotating' then (select starts + interval '7 days' from wk) end
  from public.shop_items i
  left join ranked r on r.id = i.id
  where i.tier = 'permanent'
     or r.rn <= (case i.kind when 'card_back' then 3 else 1 end)
  order by i.tier desc, i.kind, i.price, i.id;
$$;
