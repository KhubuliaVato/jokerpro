-- The admin panel: who may use it, a log of what they did, and the functions it calls.
--
-- Everything goes through SECURITY DEFINER functions that start with `admin_guard()`: a player who is not in
-- `admins` gets "not an admin" from every one of them, whatever the page shows. The panel never writes to a table
-- directly. Every change is written to `admin_log`.

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
drop policy if exists "admins see their own row" on public.admins;
create policy "admins see their own row" on public.admins for select to authenticated using (user_id = (select auth.uid()));

create table if not exists public.admin_log (
  id bigint generated always as identity primary key,
  admin_id uuid references auth.users (id) on delete set null,
  action text not null,
  target uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.admin_log enable row level security;
-- (no policy: only the functions below read or write it)

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

create or replace function public.admin_guard()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not an admin' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.admin_note(p_action text, p_target uuid, p_detail jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.admin_guard();
  insert into public.admin_log (admin_id, action, target, detail) values ((select auth.uid()), p_action, p_target, coalesce(p_detail, '{}'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Overview

create or replace function public.admin_overview()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r jsonb;
begin
  perform public.admin_guard();
  select jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'new_24h', (select count(*) from public.profiles where created_at > now() - interval '24 hours'),
    'new_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'active_24h', (select count(*) from auth.users where last_sign_in_at > now() - interval '24 hours'),
    'results', (select count(*) from public.game_results),
    'results_24h', (select count(*) from public.game_results where played_at > now() - interval '24 hours'),
    'tables_waiting', (select count(*) from public.game_tables where status = 'waiting'),
    'tables_playing', (select count(*) from public.game_tables where status = 'playing'),
    'tables_finished', (select count(*) from public.game_tables where status = 'finished'),
    'coins_total', (select coalesce(sum(balance), 0) from public.player_coins),
    'coins_paid_7d', (select coalesce(sum(amount), 0) from public.coin_log where created_at > now() - interval '7 days'),
    'items_owned', (select count(*) from public.user_items),
    'bans', (select count(*) from public.play_bans where until > now()),
    'gifts', (select count(*) from public.gifts),
    'referrals', (select count(*) from public.referrals),
    'by_game', (select coalesce(jsonb_object_agg(game, c), '{}'::jsonb) from (select game, count(*) c from public.game_results group by game) x),
    'signups', (
      select coalesce(jsonb_agg(jsonb_build_object('d', d, 'n', n) order by d), '[]'::jsonb)
      from (
        select g::date d, (select count(*) from public.profiles where created_at::date = g::date) n
        from generate_series(current_date - 13, current_date, interval '1 day') g
      ) s
    )
  ) into r;
  return r;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Players

create or replace function public.admin_users(p_query text default null, p_limit integer default 50, p_offset integer default 0)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  q text := btrim(coalesce(p_query, ''));
  out jsonb;
begin
  perform public.admin_guard();
  select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into out from (
    select
      p.id, p.nickname, u.email, p.created_at, u.last_sign_in_at,
      p.avatar_color, p.avatar_icon, p.avatar_url,
      coalesce(c.balance, 0) as balance,
      (select coalesce(sum(games), 0) from public.player_ratings where user_id = p.id) as games,
      (select count(*) from public.user_items where user_id = p.id) as items,
      b.until as banned_until,
      exists (select 1 from public.admins a where a.user_id = p.id) as is_admin
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.player_coins c on c.user_id = p.id
    left join public.play_bans b on b.user_id = p.id and b.until > now()
    where q = '' or p.nickname ilike '%' || q || '%' or u.email ilike '%' || q || '%'
    order by p.created_at desc
    limit least(greatest(coalesce(p_limit, 50), 1), 200)
    offset greatest(coalesce(p_offset, 0), 0)
  ) r;
  return out;
end;
$$;

create or replace function public.admin_user(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  out jsonb;
begin
  perform public.admin_guard();
  select jsonb_build_object(
    'id', p.id,
    'nickname', p.nickname,
    'email', u.email,
    'created_at', p.created_at,
    'last_sign_in_at', u.last_sign_in_at,
    'avatar_color', p.avatar_color, 'avatar_icon', p.avatar_icon, 'avatar_url', p.avatar_url,
    'equipped', jsonb_build_object('back', p.equipped_back, 'frame', p.equipped_frame, 'name', p.equipped_name, 'fx', p.equipped_fx),
    'balance', coalesce((select balance from public.player_coins where user_id = p.id), 0),
    'is_admin', exists (select 1 from public.admins a where a.user_id = p.id),
    'banned_until', (select until from public.play_bans where user_id = p.id and until > now()),
    'ratings', (select coalesce(jsonb_agg(jsonb_build_object('game', game, 'rating', rating, 'games', games, 'wins', wins, 'peak', peak) order by game), '[]'::jsonb) from public.player_ratings where user_id = p.id),
    'items', (select coalesce(jsonb_agg(jsonb_build_object('id', ui.item_id, 'kind', si.kind, 'price', ui.price, 'at', ui.acquired_at) order by ui.acquired_at desc), '[]'::jsonb)
              from public.user_items ui join public.shop_items si on si.id = ui.item_id where ui.user_id = p.id),
    'results', (select coalesce(jsonb_agg(jsonb_build_object('game', game, 'kind', kind, 'format', format, 'place', place, 'score', score, 'online', online, 'at', played_at, 'before', rating_before, 'after', rating_after) order by played_at desc), '[]'::jsonb)
                from (select * from public.game_results where user_id = p.id order by played_at desc limit 15) gr),
    'coins', (select coalesce(jsonb_agg(jsonb_build_object('amount', amount, 'reason', reason, 'at', created_at) order by created_at desc), '[]'::jsonb)
              from (select * from public.coin_log where user_id = p.id order by created_at desc limit 15) cl),
    'gifts_sent', (select count(*) from public.gifts where from_user = p.id),
    'gifts_received', (select count(*) from public.gifts where to_user = p.id),
    'invited', (select count(*) from public.referrals where inviter = p.id)
  ) into out
  from public.profiles p join auth.users u on u.id = p.id
  where p.id = p_user;
  if out is null then
    raise exception 'no such player' using errcode = 'P0001';
  end if;
  return out;
end;
$$;

-- Adds (or, with a minus, takes away) coins; the balance never goes below zero. Returns the new balance.
create or replace function public.admin_grant_coins(p_user uuid, p_amount integer, p_note text default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  nb integer;
begin
  perform public.admin_guard();
  if p_amount is null or p_amount = 0 then
    raise exception 'amount must not be zero' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'no such player' using errcode = 'P0001';
  end if;
  insert into public.player_coins (user_id, balance) values (p_user, greatest(p_amount, 0))
  on conflict (user_id) do update set balance = greatest(public.player_coins.balance + p_amount, 0), updated_at = now()
  returning balance into nb;
  perform public.admin_note('coins', p_user, jsonb_build_object('amount', p_amount, 'balance', nb, 'note', p_note));
  return nb;
end;
$$;

create or replace function public.admin_grant_item(p_user uuid, p_item text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.admin_guard();
  if not exists (select 1 from public.shop_items where id = p_item) then
    raise exception 'no such item' using errcode = 'P0001';
  end if;
  insert into public.user_items (user_id, item_id, price) values (p_user, p_item, 0) on conflict do nothing;
  perform public.admin_note('item+', p_user, jsonb_build_object('item', p_item));
end;
$$;

-- Takes an item away (and off the player, if they were wearing it).
create or replace function public.admin_revoke_item(p_user uuid, p_item text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.admin_guard();
  delete from public.user_items where user_id = p_user and item_id = p_item;
  update public.profiles set
    equipped_back = case when equipped_back = p_item then null else equipped_back end,
    equipped_frame = case when equipped_frame = p_item then null else equipped_frame end,
    equipped_name = case when equipped_name = p_item then null else equipped_name end,
    equipped_fx = case when equipped_fx = p_item then null else equipped_fx end
  where id = p_user;
  perform public.admin_note('item-', p_user, jsonb_build_object('item', p_item));
end;
$$;

create or replace function public.admin_set_rating(p_user uuid, p_game text, p_rating integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.admin_guard();
  if p_game not in ('joker', 'bura') then
    raise exception 'unknown game' using errcode = 'P0001';
  end if;
  if p_rating is null or p_rating < 0 then
    raise exception 'bad rating' using errcode = 'P0001';
  end if;
  insert into public.player_ratings (user_id, game, rating, games, wins, peak) values (p_user, p_game, p_rating, 0, 0, p_rating)
  on conflict (user_id, game) do update set rating = p_rating, peak = greatest(public.player_ratings.peak, p_rating), updated_at = now();
  perform public.admin_note('rating', p_user, jsonb_build_object('game', p_game, 'rating', p_rating));
end;
$$;

create or replace function public.admin_ban(p_user uuid, p_hours integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.admin_guard();
  if p_user = (select auth.uid()) then
    raise exception 'cannot ban yourself' using errcode = 'P0001';
  end if;
  if p_hours is null or p_hours < 1 then
    raise exception 'bad duration' using errcode = 'P0001';
  end if;
  insert into public.play_bans (user_id, until) values (p_user, now() + make_interval(hours => p_hours))
  on conflict (user_id) do update set until = excluded.until, return_until = null, table_id = null;
  perform public.admin_note('ban', p_user, jsonb_build_object('hours', p_hours));
end;
$$;

create or replace function public.admin_unban(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.admin_guard();
  delete from public.play_bans where user_id = p_user;
  perform public.admin_note('unban', p_user, '{}'::jsonb);
end;
$$;

create or replace function public.admin_set_nickname(p_user uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean text := btrim(coalesce(p_name, ''));
  old text;
begin
  perform public.admin_guard();
  if char_length(clean) not between 2 and 16 then
    raise exception 'bad nickname' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.profiles where lower(nickname) = lower(clean) and id <> p_user) then
    raise exception 'nickname taken' using errcode = 'P0001';
  end if;
  select nickname into old from public.profiles where id = p_user;
  perform set_config('app.nick_ok', '1', true);
  update public.profiles set nickname = clean where id = p_user;
  perform public.admin_note('nickname', p_user, jsonb_build_object('from', old, 'to', clean));
end;
$$;

create or replace function public.admin_set_admin(p_user uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.admin_guard();
  if p_on then
    insert into public.admins (user_id) values (p_user) on conflict do nothing;
  else
    if p_user = (select auth.uid()) then
      raise exception 'cannot remove yourself' using errcode = 'P0001';
    end if;
    delete from public.admins where user_id = p_user;
  end if;
  perform public.admin_note(case when p_on then 'admin+' else 'admin-' end, p_user, '{}'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Tables and chat

create or replace function public.admin_tables(p_status text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  out jsonb;
begin
  perform public.admin_guard();
  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc), '[]'::jsonb) into out from (
    select
      g.id, g.code, g.game, g.kind, g.status, g.created_at,
      (select coalesce(jsonb_agg(jsonb_build_object('seat', s.seat, 'user', s.user_id, 'nickname', p.nickname, 'bot', s.bot) order by s.seat), '[]'::jsonb)
       from public.table_seats s left join public.profiles p on p.id = s.user_id where s.table_id = g.id) as seats
    from public.game_tables g
    where p_status is null or p_status = '' or g.status = p_status
    order by g.created_at desc
    limit 60
  ) r;
  return out;
end;
$$;

-- Closes a table that is stuck (nobody can move): no result is recorded.
create or replace function public.admin_close_table(p_table uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.admin_guard();
  update public.game_tables set status = 'closed' where id = p_table and status in ('waiting', 'playing');
  perform public.admin_note('table-close', null, jsonb_build_object('table', p_table));
end;
$$;

create or replace function public.admin_chat(p_limit integer default 80)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  out jsonb;
begin
  perform public.admin_guard();
  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc), '[]'::jsonb) into out from (
    select m.id, m.body, m.created_at, m.user_id, p.nickname, g.code as table_code, g.game
    from public.table_messages m
    left join public.profiles p on p.id = m.user_id
    left join public.game_tables g on g.id = m.table_id
    order by m.created_at desc
    limit least(greatest(coalesce(p_limit, 80), 1), 300)
  ) r;
  return out;
end;
$$;

create or replace function public.admin_delete_message(p_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.admin_guard();
  delete from public.table_messages where id = p_id;
  perform public.admin_note('message-delete', null, jsonb_build_object('message', p_id));
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Shop and the log

create or replace function public.admin_shop()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  out jsonb;
begin
  perform public.admin_guard();
  select coalesce(jsonb_agg(to_jsonb(r) order by r.kind, r.price), '[]'::jsonb) into out from (
    select i.id, i.kind, i.price, i.tier, (select count(*) from public.user_items u where u.item_id = i.id) as owners
    from public.shop_items i
  ) r;
  return out;
end;
$$;

create or replace function public.admin_set_price(p_item text, p_price integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.admin_guard();
  if p_price is null or p_price < 1 then
    raise exception 'bad price' using errcode = 'P0001';
  end if;
  update public.shop_items set price = p_price where id = p_item;
  perform public.admin_note('price', null, jsonb_build_object('item', p_item, 'price', p_price));
end;
$$;

create or replace function public.admin_set_tier(p_item text, p_tier text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.admin_guard();
  if p_tier not in ('permanent', 'rotating') then
    raise exception 'bad tier' using errcode = 'P0001';
  end if;
  update public.shop_items set tier = p_tier where id = p_item;
  perform public.admin_note('tier', null, jsonb_build_object('item', p_item, 'tier', p_tier));
end;
$$;

create or replace function public.admin_log_list(p_limit integer default 100)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  out jsonb;
begin
  perform public.admin_guard();
  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc), '[]'::jsonb) into out from (
    select l.id, l.action, l.detail, l.created_at, a.nickname as admin, t.nickname as target
    from public.admin_log l
    left join public.profiles a on a.id = l.admin_id
    left join public.profiles t on t.id = l.target
    order by l.created_at desc
    limit least(greatest(coalesce(p_limit, 100), 1), 500)
  ) r;
  return out;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Only signed-in players may call these (each one still checks `admins` itself).

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and (p.proname like 'admin\_%' or p.proname = 'is_admin')
  loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end;
$$;
