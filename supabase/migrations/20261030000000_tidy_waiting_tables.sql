-- Waiting rooms must not pile up: creating a table closes the player's own earlier waiting tables
-- (and leaves their seat), and any waiting table that has sat around for hours is closed.
create or replace function public.create_table(p_rules jsonb)
returns public.game_tables
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no 0/O, 1/I
  clean jsonb;
  t public.game_tables;
  c text;
  i int;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  -- Housekeeping.
  update public.game_tables set status = 'closed'
    where status = 'waiting' and created_at < now() - interval '3 hours';
  delete from public.table_seats s
    using public.game_tables g
    where s.table_id = g.id and g.status = 'waiting' and s.user_id = uid;
  update public.game_tables g set status = 'closed'
    where g.status = 'waiting' and not exists (select 1 from public.table_seats s where s.table_id = g.id);

  -- Only known settings, with known values.
  clean := jsonb_build_object(
    'format', case when p_rules ->> 'format' = 'nine' then 'nine' else 'full' end,
    'khishti', case when (p_rules ->> 'khishti') in ('100', '200', '500') then (p_rules ->> 'khishti')::int else 200 end,
    'passScore', 50,
    'missPerTrick', 10,
    'pulkaPremium', coalesce((p_rules ->> 'pulkaPremium')::boolean, true)
  );

  loop
    c := '';
    for i in 1..6 loop
      c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    begin
      insert into public.game_tables (code, host_id, rules) values (c, uid, clean) returning * into t;
      exit;
    exception when unique_violation then
      null; -- code already used, draw another
    end;
  end loop;

  insert into public.table_seats (table_id, seat, user_id) values (t.id, 0, uid);
  return t;
end;
$$;
