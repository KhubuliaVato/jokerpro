-- Three more site backgrounds: two that move and one with card suits (drawn by the app, see lib/themes.ts).

insert into public.shop_items (id, kind, price, tier) values
  ('northern', 'theme', 150, 'permanent'),
  ('suits', 'theme', 100, 'permanent'),
  ('embers', 'theme', 150, 'permanent');
