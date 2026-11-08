-- The Carbon pack: the carbon card back (already in the shop) with a matching background, frame, name, effects, sound and reaction.
insert into public.shop_items (id, kind, price, tier) values
  ('carbonbg', 'theme', 1500, 'permanent'),
  ('f_carbon', 'frame', 2500, 'permanent'),
  ('n_carbon', 'name_style', 1800, 'permanent'),
  ('w_carbon', 'win_fx', 2500, 'permanent'),
  ('p_carbon', 'play_fx', 250, 'permanent'),
  ('s_carbon', 'sound_pack', 200, 'permanent'),
  ('r_flag', 'reaction', 200, 'permanent')
on conflict (id) do nothing;

insert into public.shop_bundles (id, price, sort) values ('b_carbon', 9500, 2);
insert into public.shop_bundle_items (bundle_id, item_id) values
  ('b_carbon', 'carbon'), ('b_carbon', 'carbonbg'), ('b_carbon', 'f_carbon'), ('b_carbon', 'n_carbon'),
  ('b_carbon', 'w_carbon'), ('b_carbon', 'p_carbon'), ('b_carbon', 's_carbon'), ('b_carbon', 'r_flag');
