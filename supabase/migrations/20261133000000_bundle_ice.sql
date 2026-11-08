-- The Ice pack: the Ice card back (id frost, already in the shop) with a matching background, frame, name, effects, sound and reaction.
insert into public.shop_items (id, kind, price, tier) values
  ('glacier', 'theme', 1600, 'permanent'),
  ('f_ice', 'frame', 2500, 'permanent'),
  ('n_glacier', 'name_style', 1800, 'permanent'),
  ('w_ice', 'win_fx', 2500, 'permanent'),
  ('p_shatter', 'play_fx', 250, 'permanent'),
  ('s_ice', 'sound_pack', 200, 'permanent'),
  ('r_cold', 'reaction', 200, 'permanent')
on conflict (id) do nothing;

insert into public.shop_bundles (id, price, sort) values ('b_ice', 7800, 3);
insert into public.shop_bundle_items (bundle_id, item_id) values
  ('b_ice', 'frost'), ('b_ice', 'glacier'), ('b_ice', 'f_ice'), ('b_ice', 'n_glacier'),
  ('b_ice', 'w_ice'), ('b_ice', 'p_shatter'), ('b_ice', 's_ice'), ('b_ice', 'r_cold');
