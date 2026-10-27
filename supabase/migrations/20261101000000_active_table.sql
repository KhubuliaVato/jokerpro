-- A player cannot be in two games at once, and can find their running game again after closing the page.

create function public.my_active_table()
returns public.game_tables
language sql
stable
security definer
set search_path = ''
as $$
  select g.*
  from public.game_tables g
  join public.table_seats s on s.table_id = g.id
  where s.user_id = (select auth.uid()) and not s.bot and g.status = 'playing'
  order by g.created_at desc
  limit 1;
$$;

revoke execute on function public.my_active_table() from public, anon;
grant execute on function public.my_active_table() to authenticated;

-- Opening a new lobby while a game is still running is refused (leave the game first, which hands the seat to a bot).
create or replace function public.find_table(p_kind text, p_format text)
returns public.game_tables
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  my_rating int;
  t public.game_tables;
  s int;
  i int;
  c text;
  seated boolean := false;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if p_kind not in ('ranked', 'friendly') or p_format not in ('nine', 'full') then
    raise exception 'bad request' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.table_seats s join public.game_tables g on g.id = s.table_id
    where s.user_id = uid and not s.bot and g.status = 'playing'
  ) then
    raise exception 'already in a game' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext('find_table:' || p_kind || ':' || p_format));

  delete from public.table_seats s
    using public.game_tables g
    where s.table_id = g.id
      and g.status = 'waiting'
      and ((g.kind <> 'private' and s.last_seen < now() - interval '40 seconds')
           or (g.kind <> 'private' and s.user_id = uid));
  update public.game_tables g set status = 'closed'
    where g.status = 'waiting' and not exists (select 1 from public.table_seats s where s.table_id = g.id);

  select coalesce((select rating from public.player_ratings where user_id = uid and game = 'joker'), 50)
    into my_rating;

  select g.* into t
  from public.game_tables g
  where g.status = 'waiting'
    and g.kind = p_kind
    and g.rules ->> 'format' = p_format
    and (select count(*) from public.table_seats s where s.table_id = g.id) < 4
    and (
      p_kind <> 'ranked'
      or abs(
        coalesce((
          select avg(coalesce(pr.rating, 50))
          from public.table_seats s
          left join public.player_ratings pr on pr.user_id = s.user_id and pr.game = 'joker'
          where s.table_id = g.id
        ), 50) - my_rating
      ) <= 100 + extract(epoch from (now() - g.created_at)) * 5
    )
  order by g.created_at
  limit 1;

  if found then
    for s in 0..3 loop
      begin
        insert into public.table_seats (table_id, seat, user_id) values (t.id, s, uid);
        seated := true;
        exit;
      exception when unique_violation then
        null;
      end;
    end loop;
    if seated then
      return t;
    end if;
  end if;

  loop
    c := '';
    for i in 1..6 loop
      c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    begin
      insert into public.game_tables (code, host_id, kind, rules)
      values (
        c, uid, p_kind,
        jsonb_build_object('format', p_format, 'khishti', 200, 'passScore', 50, 'missPerTrick', 10, 'pulkaPremium', true)
      )
      returning * into t;
      exit;
    exception when unique_violation then
      null;
    end;
  end loop;
  insert into public.table_seats (table_id, seat, user_id) values (t.id, 0, uid);
  return t;
end;
$$;
