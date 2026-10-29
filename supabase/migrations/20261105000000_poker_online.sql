-- Online Texas Hold'em: private tables for 2 to 6 friends, play chips, nothing is rated or recorded.
--   Poker rules: {"game": "poker", "format": "p2".."p6", "players": 2..6, "smallBlind": n, "bigBlind": n, "startStack": n}
-- Everything that counts seats already asks for the table's capacity (rules.players), so only the game list and
-- the creation of a table change.

alter table public.game_tables drop constraint if exists game_tables_game_check;
alter table public.game_tables
  add constraint game_tables_game_check check (game in ('joker', 'bura', 'poker'));

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
  g text := case p_rules ->> 'game' when 'bura' then 'bura' when 'poker' then 'poker' else 'joker' end;
  n int;
  big int;
  t public.game_tables;
  c text;
  i int;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  update public.game_tables set status = 'closed'
    where status = 'waiting' and created_at < now() - interval '3 hours';
  delete from public.table_seats s
    using public.game_tables gt
    where s.table_id = gt.id and gt.status = 'waiting' and s.user_id = uid;
  update public.game_tables gt set status = 'closed'
    where gt.status = 'waiting' and not exists (select 1 from public.table_seats s where s.table_id = gt.id);

  -- Only known settings, with known values.
  if g = 'bura' then
    n := case when (p_rules ->> 'players') = '4' then 4 else 2 end;
    clean := jsonb_build_object('game', 'bura', 'format', 'p' || n, 'players', n);
  elsif g = 'poker' then
    n := case when (p_rules ->> 'players') in ('2', '3', '4', '5', '6') then (p_rules ->> 'players')::int else 6 end;
    big := case when (p_rules ->> 'bigBlind') in ('10', '20', '50') then (p_rules ->> 'bigBlind')::int else 20 end;
    clean := jsonb_build_object(
      'game', 'poker',
      'format', 'p' || n,
      'players', n,
      'smallBlind', big / 2,
      'bigBlind', big,
      'startStack', big * 50
    );
  else
    clean := jsonb_build_object(
      'format', case when p_rules ->> 'format' = 'nine' then 'nine' else 'full' end,
      'khishti', case when (p_rules ->> 'khishti') in ('100', '200', '500') then (p_rules ->> 'khishti')::int else 200 end,
      'passScore', 50,
      'missPerTrick', 10,
      'pulkaPremium', coalesce((p_rules ->> 'pulkaPremium')::boolean, true)
    );
  end if;

  loop
    c := '';
    for i in 1..6 loop
      c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    begin
      insert into public.game_tables (code, host_id, rules, game) values (c, uid, clean, g) returning * into t;
      exit;
    exception when unique_violation then
      null; -- code already used, draw another
    end;
  end loop;

  insert into public.table_seats (table_id, seat, user_id) values (t.id, 0, uid);
  return t;
end;
$$;
