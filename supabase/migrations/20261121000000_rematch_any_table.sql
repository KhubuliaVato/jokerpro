-- A rematch is now possible after any finished table (friendly and ranked ones too).
-- The new table is always a private one with the same rules: it is not rated and not saved to the history.

create or replace function public.rematch(p_table_id uuid)
returns public.game_tables
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  prev public.game_tables;
  fresh public.game_tables;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  -- One at a time per table, so that two players asking together end up at the same new table.
  select * into prev from public.game_tables where id = p_table_id for update;
  if not found or prev.status not in ('finished', 'closed') then
    raise exception 'no rematch' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.table_seats where table_id = prev.id and user_id = uid and not bot) then
    raise exception 'not seated' using errcode = '42501';
  end if;

  if prev.rematch_code is not null then
    select * into fresh from public.game_tables where code = prev.rematch_code and status = 'waiting';
    if found then
      return public.join_table(prev.rematch_code);
    end if;
  end if;

  fresh := public.create_table(prev.rules);
  update public.game_tables set rematch_code = fresh.code where id = prev.id;
  return fresh;
end;
$$;
