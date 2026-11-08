-- A player may throw something at another player once a minute.

create or replace function public.send_table_message(p_table_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  clean text := btrim(regexp_replace(coalesce(p_body, ''), '\s+', ' ', 'g'));
  item text;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if not public.is_table_member(p_table_id) then
    raise exception 'not seated' using errcode = '42501';
  end if;
  if clean = '' then
    return;
  end if;
  if exists (select 1 from public.game_tables g where g.id = p_table_id and g.status in ('finished', 'closed')) then
    return;
  end if;

  if left(clean, 2) = '::' then
    if clean ~ '^::r:[a-z_]+$' then
      item := substring(clean from '^::r:([a-z_]+)$');
    elsif clean ~ '^::t:[a-z_]+\.[0-3]$' then
      item := substring(clean from '^::t:([a-z_]+)\.');
      -- one throw a minute per player, so nobody is pelted all game long
      if exists (select 1 from public.table_messages m
                 where m.table_id = p_table_id and m.user_id = uid and m.body like '::t:%'
                   and m.created_at > now() - interval '60 seconds') then
        raise exception 'throw too soon' using errcode = '54000';
      end if;
    else
      raise exception 'bad emote' using errcode = 'P0001';
    end if;
    if not exists (
      select 1 from public.user_items u join public.shop_items i on i.id = u.item_id
      where u.user_id = uid and u.item_id = item and i.kind in ('reaction', 'throwable')
    ) then
      raise exception 'item not owned' using errcode = 'P0001';
    end if;
  end if;

  -- At most 6 messages in 10 seconds per player.
  if (select count(*) from public.table_messages m
      where m.table_id = p_table_id and m.user_id = uid and m.created_at > now() - interval '10 seconds') >= 6 then
    raise exception 'too many messages' using errcode = '54000';
  end if;
  insert into public.table_messages (table_id, user_id, body) values (p_table_id, uid, left(clean, 200));
end;
$$;
