-- How a player plays Joker, over their latest 100 online games: the figures of the stats page.
--
-- Read from the hands of the finished tables (kept in table_games, which a browser cannot read directly).
-- Only bids, tricks taken and points of finished hands: nothing about cards.
--   games    games with figures      hands     hands played
--   hits     hands where the player took exactly what they said
--   khishtis hands said but not won  best      the best hand in points
--   points   all hand points         streak    the longest run of kept bids inside one game

create or replace function public.player_play_stats(p_user uuid, p_game text default 'joker')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  out jsonb;
begin
  if p_game <> 'joker' then
    return null;
  end if;

  with rs as (
    select r.id, r.table_id, ts.seat
    from public.game_results r
    join public.table_seats ts on ts.table_id = r.table_id and ts.user_id = r.user_id
    where r.user_id = p_user and r.game = 'joker' and r.online
    order by r.played_at desc
    limit 100
  ),
  hs as (
    select rs.id,
           e.ord,
           (e.h -> 'bids' ->> rs.seat)::integer as b,
           (e.h -> 'taken' ->> rs.seat)::integer as tk,
           (e.h -> 'points' ->> rs.seat)::integer as pts
    from rs
    join public.table_games g on g.table_id = rs.table_id
    cross join lateral jsonb_array_elements(g.state -> 'history') with ordinality as e(h, ord)
    where jsonb_typeof(g.state -> 'history') = 'array'
  ),
  runs as (
    select count(*) as run
    from (
      select id, ord, (b is not null and b = tk) as hit,
             row_number() over (partition by id order by ord)
             - row_number() over (partition by id, (b is not null and b = tk) order by ord) as grp
      from hs
    ) x
    where hit
    group by id, grp
  )
  select jsonb_build_object(
    'games', (select count(distinct id) from hs),
    'hands', (select count(*) from hs),
    'hits', (select count(*) from hs where b is not null and b = tk),
    'khishtis', (select count(*) from hs where coalesce(b, 0) > 0 and tk = 0),
    'best', (select coalesce(max(pts), 0) from hs),
    'points', (select coalesce(sum(pts), 0) from hs),
    'streak', (select coalesce(max(run), 0) from runs)
  ) into out;
  return out;
end;
$$;

revoke all on function public.player_play_stats(uuid, text) from public;
grant execute on function public.player_play_stats(uuid, text) to anon, authenticated;
