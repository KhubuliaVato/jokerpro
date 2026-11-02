-- New prices of the decks (what players already paid stays as it is in user_items.price).

update public.shop_items set price = 150 where id in ('damask', 'crimson', 'emerald');
update public.shop_items set price = 200 where id = 'frost';
update public.shop_items set price = 250 where id = 'obsidian';
update public.shop_items set price = 300 where id in ('carbon', 'midnight');
