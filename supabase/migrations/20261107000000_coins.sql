-- Virtual coins: earned for winning a game and for the achievements of the profile.
--
--   player_coins   the balance of each player (written only by the database itself)
--   coin_log       every grant; a (player, reason, ref) can be granted once, so nothing is paid twice
--
-- Winning (1st place) pays 5 coins, +2 for a ranked game, +3 for a full game: 5 to 10.
-- Each achievement pays a fixed 5 to 10 once. Both are granted by a trigger on game_results,
-- so a browser cannot ask for coins.

create table public.player_coins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

alter table public.player_coins enable row level security;

create policy "players read their own balance"
  on public.player_coins for select to authenticated using ((select auth.uid()) = user_id);

create table public.coin_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount integer not null check (amount > 0),
  reason text not null check (reason in ('win', 'achievement')),
  -- the result (win) or the achievement id the coins were paid for
  ref text not null,
  table_id uuid references public.game_tables (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, reason, ref)
);

create index coin_log_user_idx on public.coin_log (user_id, created_at desc);
create index coin_log_table_idx on public.coin_log (table_id, user_id);

alter table public.coin_log enable row level security;

create policy "players read their own coin log"
  on public.coin_log for select to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------------------------

-- Pays once per (player, reason, ref); returns the amount actually paid (0 if it was paid before).
create function public.grant_coins(p_user uuid, p_amount integer, p_reason text, p_ref text, p_table uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  paid uuid;
begin
  insert into public.coin_log (user_id, amount, reason, ref, table_id)
  values (p_user, p_amount, p_reason, p_ref, p_table)
  on conflict (user_id, reason, ref) do nothing
  returning id into paid;

  if paid is null then
    return 0;
  end if;

  insert into public.player_coins (user_id, balance) values (p_user, p_amount)
  on conflict (user_id) do update set balance = public.player_coins.balance + p_amount, updated_at = now();
  return p_amount;
end;
$$;

-- Pays every achievement (they are the joker ones, as on the profile) the player has reached and has not been paid for yet.
create function public.grant_achievement_coins(p_user uuid, p_table uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  played integer;
  wins integer;
  best integer;
  streak integer;
  full_win boolean;
begin
  select count(*), count(*) filter (where place = 1), coalesce(max(score), 0),
         coalesce(bool_or(format = 'full' and place = 1), false)
    into played, wins, best, full_win
    from public.game_results where user_id = p_user and game = 'joker';

  -- longest run of consecutive wins, oldest game first
  select coalesce(max(run), 0) into streak
  from (
    select count(*) as run
    from (
      select place,
             row_number() over (order by played_at, id)
             - row_number() over (partition by (place = 1) order by played_at, id) as grp
      from public.game_results where user_id = p_user and game = 'joker'
    ) g
    where place = 1
    group by grp
  ) runs;

  if wins >= 1 then perform public.grant_coins(p_user, 5, 'achievement', 'first', p_table); end if;
  if played >= 10 then perform public.grant_coins(p_user, 5, 'achievement', 'ten', p_table); end if;
  if best >= 500 then perform public.grant_coins(p_user, 7, 'achievement', 'score', p_table); end if;
  if streak >= 3 then perform public.grant_coins(p_user, 8, 'achievement', 'streak', p_table); end if;
  if full_win then perform public.grant_coins(p_user, 10, 'achievement', 'full', p_table); end if;
end;
$$;

create function public.pay_game_coins()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.place = 1 then
    perform public.grant_coins(
      new.user_id,
      5 + (case when new.kind = 'ranked' then 2 else 0 end) + (case when new.format = 'full' then 3 else 0 end),
      'win', new.id::text, new.table_id
    );
  end if;
  perform public.grant_achievement_coins(new.user_id, new.table_id);
  return new;
end;
$$;

create trigger game_results_pay_coins
  after insert on public.game_results
  for each row execute function public.pay_game_coins();

revoke execute on function
  public.grant_coins(uuid, integer, text, text, uuid),
  public.grant_achievement_coins(uuid, uuid),
  public.pay_game_coins()
  from public, anon, authenticated;

-- Games played before the coins existed are paid too, once.
do $$
declare
  r record;
begin
  for r in select id, user_id, place, kind, format, table_id from public.game_results where place = 1 loop
    perform public.grant_coins(
      r.user_id,
      5 + (case when r.kind = 'ranked' then 2 else 0 end) + (case when r.format = 'full' then 3 else 0 end),
      'win', r.id::text, r.table_id
    );
  end loop;
  for r in select distinct user_id from public.game_results loop
    perform public.grant_achievement_coins(r.user_id);
  end loop;
end;
$$;
