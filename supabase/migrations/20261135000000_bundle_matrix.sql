-- The Matrix pack: an animated code card back, falling-code background, scanline frame, name, effects, sound and reaction.
insert into public.shop_items (id, kind, price, tier) values
  ('matrix', 'card_back', 6000, 'permanent'),
  ('matrixbg', 'theme', 1800, 'permanent'),
  ('f_matrix', 'frame', 2500, 'permanent'),
  ('n_matrix', 'name_style', 1800, 'permanent'),
  ('w_matrix', 'win_fx', 2500, 'permanent'),
  ('p_matrix', 'play_fx', 250, 'permanent'),
  ('s_matrix', 'sound_pack', 200, 'permanent'),
  ('r_pill', 'reaction', 200, 'permanent')
on conflict (id) do nothing;

insert into public.shop_bundles (id, price, sort) values ('b_matrix', 10500, 5);
insert into public.shop_bundle_items (bundle_id, item_id) values
  ('b_matrix', 'matrix'), ('b_matrix', 'matrixbg'), ('b_matrix', 'f_matrix'), ('b_matrix', 'n_matrix'),
  ('b_matrix', 'w_matrix'), ('b_matrix', 'p_matrix'), ('b_matrix', 's_matrix'), ('b_matrix', 'r_pill');
