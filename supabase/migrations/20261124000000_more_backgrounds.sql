-- Five more site backgrounds (shop): dusk and bronze are plain, snow, a starry night and waves move.
insert into public.shop_items (id, kind, price, tier) values
  ('dusk', 'theme', 300, 'permanent'),
  ('bronze', 'theme', 300, 'permanent'),
  ('snow', 'theme', 1200, 'permanent'),
  ('waves', 'theme', 1400, 'permanent'),
  ('stars', 'theme', 1600, 'permanent')
on conflict (id) do nothing;
