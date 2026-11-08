-- City leaderboard: each player may name the city they play for; the cities compete.
--
-- A player's score is the rating they have earned above the starting 50, in Joker and Bura together.
-- A city's points are the scores of its ten best players added up (so a big city does not win just by being big).
-- The city can be changed once a week.

create table if not exists public.cities (
  id text primary key
);
alter table public.cities enable row level security;
drop policy if exists "cities are public" on public.cities;
create policy "cities are public" on public.cities for select to anon, authenticated using (true);

insert into public.cities (id) values
  ('tbilisi'), ('batumi'), ('kutaisi'), ('rustavi'), ('gori'), ('zugdidi'), ('poti'), ('kobuleti'), ('khashuri'),
  ('samtredia'), ('senaki'), ('zestafoni'), ('marneuli'), ('telavi'), ('akhaltsikhe'), ('ozurgeti'), ('kaspi'),
  ('borjomi'), ('mtskheta'), ('gardabani'), ('sagarejo'), ('tskaltubo'), ('chiatura'), ('ambrolauri'), ('lanchkhuti'),
  ('abroad')
on conflict do nothing;

alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists city_changed_at timestamptz;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_city_fkey') then
    alter table public.profiles add constraint profiles_city_fkey foreign key (city) references public.cities (id) on update cascade on delete set null;
  end if;
end;
$$;
create index if not exists profiles_city_idx on public.profiles (city) where city is not null;

-- The player's own city (nothing is written straight to the table: the column is not in the grants).
create or replace function public.set_city(p_city text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  old_city text;
  changed timestamptz;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if not exists (select 1 from public.cities where id = p_city) then
    raise exception 'no such city' using errcode = 'P0001';
  end if;
  select city, city_changed_at into old_city, changed from public.profiles where id = uid;
  if old_city is not null and old_city is distinct from p_city and changed is not null and changed > now() - interval '7 days' then
    raise exception 'city locked until %', to_char((changed + interval '7 days') at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') using errcode = 'P0001';
  end if;
  if old_city is distinct from p_city then
    update public.profiles set city = p_city, city_changed_at = now() where id = uid;
  end if;
end;
$$;

create or replace function public.my_city()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('city', p.city, 'can_change_at', case when p.city is null then null else p.city_changed_at + interval '7 days' end)
  from public.profiles p where p.id = (select auth.uid());
$$;

-- All cities with at least one player, the best first.
create or replace function public.city_board()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with scores as (
    select
      p.id, p.city, p.nickname,
      coalesce((select sum(greatest(r.rating - 50, 0)) from public.player_ratings r where r.user_id = p.id and r.game in ('joker', 'bura')), 0)::int as score
    from public.profiles p
    where p.city is not null
  ),
  ranked as (
    select s.*, row_number() over (partition by s.city order by s.score desc, s.nickname) as rn from scores s
  )
  select coalesce(jsonb_agg(to_jsonb(c) order by c.points desc, c.players desc, c.city), '[]'::jsonb)
  from (
    select
      r.city,
      count(*)::int as players,
      count(*) filter (where r.score > 0)::int as active,
      coalesce(sum(r.score) filter (where r.rn <= 10), 0)::int as points,
      (array_agg(r.nickname order by r.rn))[1] as leader,
      (array_agg(r.score order by r.rn))[1] as leader_score
    from ranked r
    group by r.city
  ) c;
$$;

-- The best players of one city.
create or replace function public.city_players(p_city text, p_limit integer default 10)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.score desc, x.nickname), '[]'::jsonb)
  from (
    select
      p.id, p.nickname, p.avatar_color, p.avatar_icon, p.avatar_url, p.equipped_frame, p.equipped_name,
      coalesce((select sum(greatest(r.rating - 50, 0)) from public.player_ratings r where r.user_id = p.id and r.game in ('joker', 'bura')), 0)::int as score
    from public.profiles p
    where p.city = p_city
    order by score desc, p.nickname
    limit least(greatest(coalesce(p_limit, 10), 1), 50)
  ) x;
$$;

revoke all on function public.set_city(text), public.my_city() from public, anon;
grant execute on function public.set_city(text), public.my_city() to authenticated;
revoke all on function public.city_board(), public.city_players(text, integer) from public;
grant execute on function public.city_board(), public.city_players(text, integer) to anon, authenticated;

-- The admin panel can set a player's city (the one-week lock does not apply).
create or replace function public.admin_set_city(p_user uuid, p_city text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.admin_guard();
  if p_city is not null and not exists (select 1 from public.cities where id = p_city) then
    raise exception 'no such city' using errcode = 'P0001';
  end if;
  update public.profiles set city = p_city, city_changed_at = now() where id = p_user;
  perform public.admin_note('city', p_user, jsonb_build_object('city', p_city));
end;
$$;
revoke all on function public.admin_set_city(uuid, text) from public, anon;
grant execute on function public.admin_set_city(uuid, text) to authenticated;
