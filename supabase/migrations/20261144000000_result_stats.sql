-- How each player played a finished Joker game: the main figures of the opened game in the history.
--
-- result_stats(result) reads the hands of the finished table (kept in table_games, which a browser cannot read
-- while a game runs) and gives, for every player of the result in the order of its `scores`:
--   hands    hands played            hits    hands where the player took exactly what they said
--   khishtis hands said but not won  best    the best hand in points
--   streak   the longest run of hands in a row where the player took what they said
-- Nothing about cards, only bids, tricks taken and points of finished hands.

create or replace function public.result_stats(p_result uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r public.game_results;
  seat0 integer;
  hist jsonb;
  n integer;
  size integer;
  out jsonb := '[]'::jsonb;
  k integer;
  i integer;
  sp integer;
  h jsonb;
  hits integer;
  kh integer;
  best integer;
  run integer;
  streak integer;
  b integer;
  tk integer;
  pts integer;
begin
  select * into r from public.game_results where id = p_result;
  if not found or r.game <> 'joker' or r.table_id is null then
    return null;
  end if;
  if not exists (select 1 from public.game_tables where id = r.table_id and status = 'finished') then
    return null;
  end if;
  select seat into seat0 from public.table_seats where table_id = r.table_id and user_id = r.user_id;
  select state -> 'history' into hist from public.table_games where table_id = r.table_id;
  if seat0 is null or hist is null or jsonb_typeof(hist) <> 'array' then
    return null;
  end if;

  size := greatest(coalesce(array_length(r.players, 1), 4), 1);
  n := jsonb_array_length(hist);
  for k in 0 .. size - 1 loop
    sp := (seat0 + k) % size;
    hits := 0;
    kh := 0;
    best := null;
    run := 0;
    streak := 0;
    for i in 0 .. n - 1 loop
      h := hist -> i;
      b := (h -> 'bids' ->> sp)::integer;
      tk := (h -> 'taken' ->> sp)::integer;
      pts := (h -> 'points' ->> sp)::integer;
      if b is not null and b = tk then
        hits := hits + 1;
        run := run + 1;
        streak := greatest(streak, run);
      else
        run := 0;
      end if;
      if coalesce(b, 0) > 0 and tk = 0 then
        kh := kh + 1;
      end if;
      if pts is not null then
        best := greatest(coalesce(best, pts), pts);
      end if;
    end loop;
    out := out || jsonb_build_array(jsonb_build_object('hands', n, 'hits', hits, 'khishtis', kh, 'best', coalesce(best, 0), 'streak', streak));
  end loop;
  return out;
end;
$$;

revoke all on function public.result_stats(uuid) from public;
grant execute on function public.result_stats(uuid) to anon, authenticated;
