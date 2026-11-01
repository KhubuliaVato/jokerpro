-- How many lobbies of random players are waiting for someone, per game: the menu cards show it.
-- A lobby counts while somebody at it has been seen in the last 40 seconds (the same rule find_table uses to drop idle seats).

create function public.open_tables()
returns table (game text, waiting integer)
language sql
stable
security definer
set search_path = ''
as $$
  select g.game, count(*)::integer
  from public.game_tables g
  where g.status = 'waiting'
    and g.kind <> 'private'
    and exists (
      select 1 from public.table_seats s
      where s.table_id = g.id and s.last_seen > now() - interval '40 seconds'
    )
  group by g.game;
$$;

revoke execute on function public.open_tables() from public, anon;
grant execute on function public.open_tables() to authenticated;
