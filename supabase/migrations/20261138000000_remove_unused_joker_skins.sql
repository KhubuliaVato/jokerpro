-- The classic and gilded joker skins never got a picture; nobody owned, was gifted or wore them.
delete from public.shop_items
where id in ('j_classic', 'j_gilded')
  and not exists (select 1 from public.user_items u where u.item_id = shop_items.id)
  and not exists (select 1 from public.shop_bundle_items b where b.item_id = shop_items.id);
