-- A player can delete their own account: the profile, coins, items, ratings, results, gifts and sign-in all go with it
-- (every table that points at auth.users deletes its rows with the user).
--
-- Refused while the player sits at a table that has not ended (the others would lose their game), and, for a player
-- with a second factor set up, unless this session passed that second step too.

create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  if exists (select 1 from auth.mfa_factors where user_id = uid and status = 'verified')
     and coalesce((select auth.jwt()) ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'second step needed' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.table_seats s
    join public.game_tables g on g.id = s.table_id
    where s.user_id = uid and g.status in ('waiting', 'playing')
  ) then
    raise exception 'leave your table first' using errcode = 'P0001';
  end if;

  delete from auth.users where id = uid;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
