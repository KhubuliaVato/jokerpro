-- The Goodnight pack: the Goodnight card back (id midnight, already in the shop) with a matching background, frame, name, effects, sound and reaction.
insert into public.shop_items (id, kind, price, tier) values
  ('lullaby', 'theme', 1600, 'permanent'),
  ('f_moon', 'frame', 2500, 'permanent'),
  ('n_night', 'name_style', 1800, 'permanent'),
  ('w_night', 'win_fx', 2500, 'permanent'),
  ('p_night', 'play_fx', 250, 'permanent'),
  ('s_night', 'sound_pack', 200, 'permanent'),
  ('r_moon', 'reaction', 200, 'permanent')
on conflict (id) do nothing;

insert into public.shop_bundles (id, price, sort) values ('b_night', 9800, 4);
insert into public.shop_bundle_items (bundle_id, item_id) values
  ('b_night', 'midnight'), ('b_night', 'lullaby'), ('b_night', 'f_moon'), ('b_night', 'n_night'),
  ('b_night', 'w_night'), ('b_night', 'p_night'), ('b_night', 's_night'), ('b_night', 'r_moon');
