-- Friends: a friend list with who is online right now.
--
-- A request goes by nickname; the other player accepts or declines. Presence is a heartbeat: the page tells the
-- server every minute that the player is here (`touch_presence`), and a player counts as online for about
-- two minutes after the last beat. A player may hide it (then friends see them as offline).
-- Everything goes through the functions below: the tables have no policies.

alter table public.profiles add column if not exists last_seen timestamptz;
alter table public.profiles add column if not exists hide_presence boolean not null default false;

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester uuid not null references auth.users (id) on delete cascade,
  addressee uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester <> addressee)
);
create unique index if not exists friendships_pair_idx on public.friendships (least(requester, addressee), greatest(requester, addressee));
create index if not exists friendships_addressee_idx on public.friendships (addressee);
alter table public.friendships enable row level security;

create or replace function public.touch_presence()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles set last_seen = now()
  where id = (select auth.uid()) and (last_seen is null or last_seen < now() - interval '20 seconds');
$$;

create or replace function public.set_hide_presence(p_hide boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles set hide_presence = coalesce(p_hide, false) where id = (select auth.uid());
$$;

-- Asks a player (by nickname) to be friends. Returns 'sent', 'accepted' (they had already asked us) or 'already'.
create or replace function public.friend_request(p_nickname text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  other uuid;
  existing public.friendships;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  select id into other from public.profiles where lower(nickname) = lower(btrim(coalesce(p_nickname, '')));
  if other is null then
    raise exception 'no such player' using errcode = 'P0001';
  end if;
  if other = uid then
    raise exception 'that is you' using errcode = 'P0001';
  end if;
  if (select count(*) from public.friendships where (requester = uid or addressee = uid) and status = 'accepted') >= 200 then
    raise exception 'too many friends' using errcode = 'P0001';
  end if;
  select * into existing from public.friendships
   where least(requester, addressee) = least(uid, other) and greatest(requester, addressee) = greatest(uid, other);
  if found then
    if existing.status = 'accepted' then
      return 'already';
    end if;
    if existing.requester = uid then
      return 'already';
    end if;
    update public.friendships set status = 'accepted', responded_at = now() where id = existing.id;
    return 'accepted';
  end if;
  if (select count(*) from public.friendships where requester = uid and status = 'pending') >= 50 then
    raise exception 'too many requests' using errcode = 'P0001';
  end if;
  insert into public.friendships (requester, addressee) values (uid, other);
  return 'sent';
end;
$$;

create or replace function public.friend_respond(p_user uuid, p_accept boolean)
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
  if p_accept then
    update public.friendships set status = 'accepted', responded_at = now()
     where requester = p_user and addressee = uid and status = 'pending';
  else
    delete from public.friendships where requester = p_user and addressee = uid and status = 'pending';
  end if;
end;
$$;

-- Removes a friend, or takes back a request.
create or replace function public.friend_remove(p_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.friendships
   where (requester = (select auth.uid()) and addressee = p_user) or (addressee = (select auth.uid()) and requester = p_user);
$$;

-- My friends (online first), the requests waiting for my answer, and the ones I have sent.
create or replace function public.my_friends()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  out jsonb;
begin
  if uid is null then
    return jsonb_build_object('friends', '[]'::jsonb, 'incoming', '[]'::jsonb, 'outgoing', '[]'::jsonb, 'hidden', false);
  end if;
  with mine as (
    select
      case when f.requester = uid then f.addressee else f.requester end as other,
      f.status,
      (f.requester = uid) as sent_by_me
    from public.friendships f
    where f.requester = uid or f.addressee = uid
  ),
  people as (
    select
      m.status, m.sent_by_me,
      p.id, p.nickname, p.avatar_color, p.avatar_icon, p.avatar_url, p.equipped_frame, p.equipped_name, p.city,
      (not p.hide_presence and p.last_seen is not null and p.last_seen > now() - interval '100 seconds') as online,
      case when p.hide_presence then null else p.last_seen end as last_seen,
      (
        not p.hide_presence and p.last_seen is not null and p.last_seen > now() - interval '100 seconds'
        and exists (
          select 1 from public.table_seats s join public.game_tables g on g.id = s.table_id
          where s.user_id = p.id and not s.bot and g.status = 'playing'
        )
      ) as playing,
      (
        select g.game from public.table_seats s join public.game_tables g on g.id = s.table_id
        where s.user_id = p.id and not s.bot and g.status = 'playing' limit 1
      ) as game
    from mine m join public.profiles p on p.id = m.other
  )
  select jsonb_build_object(
    'friends', coalesce((select jsonb_agg(to_jsonb(x) order by x.playing desc, x.online desc, x.last_seen desc nulls last, x.nickname) from (select * from people where status = 'accepted') x), '[]'::jsonb),
    'incoming', coalesce((select jsonb_agg(to_jsonb(x) order by x.nickname) from (select id, nickname, avatar_color, avatar_icon, avatar_url, equipped_frame, equipped_name from people where status = 'pending' and not sent_by_me) x), '[]'::jsonb),
    'outgoing', coalesce((select jsonb_agg(to_jsonb(x) order by x.nickname) from (select id, nickname from people where status = 'pending' and sent_by_me) x), '[]'::jsonb),
    'hidden', coalesce((select hide_presence from public.profiles where id = uid), false)
  ) into out;
  return out;
end;
$$;

revoke all on function public.touch_presence(), public.set_hide_presence(boolean), public.friend_request(text),
  public.friend_respond(uuid, boolean), public.friend_remove(uuid), public.my_friends() from public, anon;
grant execute on function public.touch_presence(), public.set_hide_presence(boolean), public.friend_request(text),
  public.friend_respond(uuid, boolean), public.friend_remove(uuid), public.my_friends() to authenticated;
