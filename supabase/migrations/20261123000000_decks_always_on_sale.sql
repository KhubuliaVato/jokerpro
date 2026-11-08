-- Four card decks are on sale all the time (they used to come and go with the weekly exclusives).
update public.shop_items set tier = 'permanent' where id in ('neon', 'obsidian', 'sakura', 'gilded');
