-- Ready check: when the fourth player sits down at a table of random players, everyone has 30 seconds to accept.
-- All four accepted -> the game starts. Anyone who did not accept in time loses the seat; the rest keep searching.

alter table public.table_seats add column accepted boolean not null default false;
alter table public.game_tables add column ready_at timestamptz;

create function public.ready_check_open()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.game_tables g set ready_at = now()
  where g.id = new.table_id and g.kind <> 'private' and g.status = 'waiting'
    and (select count(*) from public.table_seats s where s.table_id = g.id) = 4;
  return new;
end;
$$;

create trigger table_seats_ready_open after insert on public.table_seats
  for each row execute function public.ready_check_open();

create function public.ready_check_reset()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.game_tables g where g.id = old.table_id and g.status = 'waiting' and g.ready_at is not null) then
    update public.game_tables set ready_at = null where id = old.table_id;
    update public.table_seats set accepted = false where table_id = old.table_id;
  end if;
  return old;
end;
$$;

create trigger table_seats_ready_reset after delete on public.table_seats
  for each row execute function public.ready_check_reset();

create function public.accept_match(p_table_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.table_seats s set accepted = true
  from public.game_tables g
  where s.table_id = p_table_id and g.id = s.table_id and g.status = 'waiting' and g.ready_at is not null
    and s.user_id = (select auth.uid());
$$;

-- Time is up: the players who did not accept lose their seats (the trigger above reopens the table for the others).
create function public.expire_match(p_table_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.table_seats s
  using public.game_tables g
  where s.table_id = p_table_id and g.id = s.table_id and g.status = 'waiting'
    and g.ready_at is not null and g.ready_at < now() - interval '30 seconds'
    and not s.accepted
    and exists (select 1 from public.table_seats m where m.table_id = p_table_id and m.user_id = (select auth.uid()));
$$;

revoke execute on function public.accept_match(uuid), public.expire_match(uuid) from public, anon;
grant execute on function public.accept_match(uuid), public.expire_match(uuid) to authenticated;
revoke execute on function public.ready_check_open(), public.ready_check_reset() from public, anon, authenticated;

-- Clients count the ready check down against the server's clock, not their own.
create function public.server_time()
returns timestamptz
language sql
stable
set search_path = ''
as $$ select now(); $$;

revoke execute on function public.server_time() from public, anon;
grant execute on function public.server_time() to authenticated;
