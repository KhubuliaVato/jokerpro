-- Visit statistics for the admin panel: who comes, from which country, to which pages.
--
-- Nothing personal is kept: no IP address, no cookie, no user agent. A visit is the country (from the CDN
-- header), the page, the kind of device, the site the visitor came from, a random id that lives only as long
-- as the browser tab (to count visitors, not page views) and, when signed in, the player. Bots are not counted.
-- Rows are kept for 400 days.

create table if not exists public.visits (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  country text,
  path text not null,
  device text not null,
  referrer text,
  session text not null,
  lang text,
  user_id uuid references auth.users (id) on delete set null
);
create index if not exists visits_at_idx on public.visits (at desc);
create index if not exists visits_country_idx on public.visits (country, at desc);
alter table public.visits enable row level security;
-- (no policy: written by track_visit, read by admin_analytics)

create or replace function public.track_visit(p_path text, p_session text, p_referrer text default null, p_lang text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  headers jsonb := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  ua text := lower(coalesce(headers ->> 'user-agent', ''));
  code text := upper(btrim(coalesce(headers ->> 'cf-ipcountry', '')));
  dev text;
begin
  if p_path is null or p_session is null or length(p_session) < 8 or length(p_session) > 40 then
    return;
  end if;
  -- robots and link previewers are not visitors
  if ua ~ '(bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|monitor|python-requests|curl|wget)' then
    return;
  end if;
  -- a flood must not fill the table
  if (select count(*) from public.visits where at > now() - interval '1 hour') > 30000 then
    return;
  end if;
  dev := case
    when ua ~ '(ipad|tablet)' then 'tablet'
    when ua ~ '(mobi|android|iphone|ipod)' then 'mobile'
    else 'desktop'
  end;
  if code !~ '^[A-Z]{2}$' or code in ('XX', 'T1') then
    code := null;
  end if;
  insert into public.visits (country, path, device, referrer, session, lang, user_id)
  values (code, left(p_path, 120), dev, left(nullif(btrim(p_referrer), ''), 80), p_session, left(p_lang, 5), (select auth.uid()));
end;
$$;
revoke all on function public.track_visit(text, text, text, text) from public;
grant execute on function public.track_visit(text, text, text, text) to anon, authenticated;

-- Everything the admin analytics tab shows, for the last `p_days` days (Georgian time for the days).
create or replace function public.admin_analytics(p_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  days integer := least(greatest(coalesce(p_days, 30), 1), 400);
  since timestamptz := now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 400));
  out jsonb;
begin
  perform public.admin_guard();
  select jsonb_build_object(
    'views', (select count(*) from public.visits where at > since),
    'sessions', (select count(distinct session) from public.visits where at > since),
    'players', (select count(distinct user_id) from public.visits where at > since and user_id is not null),
    'today', (select count(distinct session) from public.visits where (at at time zone 'Asia/Tbilisi')::date = (now() at time zone 'Asia/Tbilisi')::date),
    'live', (select count(distinct session) from public.visits where at > now() - interval '5 minutes'),
    'since', (select min(at) from public.visits),
    'days', (
      select coalesce(jsonb_agg(jsonb_build_object('d', g.d, 'sessions', coalesce(v.s, 0), 'views', coalesce(v.n, 0)) order by g.d), '[]'::jsonb)
      from generate_series(((now() at time zone 'Asia/Tbilisi')::date - (least(days, 90) - 1)), (now() at time zone 'Asia/Tbilisi')::date, interval '1 day') as g(d)
      left join (
        select (at at time zone 'Asia/Tbilisi')::date as d, count(distinct session) as s, count(*) as n
        from public.visits where at > now() - interval '91 days' group by 1
      ) v on v.d = g.d::date
    ),
    'countries', (
      select coalesce(jsonb_agg(to_jsonb(c) order by c.sessions desc, c.views desc), '[]'::jsonb) from (
        select coalesce(country, '??') as country, count(distinct session) as sessions, count(*) as views, count(distinct user_id) filter (where user_id is not null) as players
        from public.visits where at > since group by 1 order by 2 desc, 3 desc limit 25
      ) c
    ),
    'pages', (
      select coalesce(jsonb_agg(to_jsonb(c) order by c.views desc), '[]'::jsonb) from (
        select path, count(*) as views, count(distinct session) as sessions
        from public.visits where at > since group by 1 order by 2 desc limit 15
      ) c
    ),
    'devices', (
      select coalesce(jsonb_object_agg(device, n), '{}'::jsonb) from (
        select device, count(distinct session) as n from public.visits where at > since group by 1
      ) c
    ),
    'referrers', (
      select coalesce(jsonb_agg(to_jsonb(c) order by c.sessions desc), '[]'::jsonb) from (
        select referrer, count(distinct session) as sessions
        from public.visits where at > since and referrer is not null group by 1 order by 2 desc limit 12
      ) c
    ),
    'langs', (
      select coalesce(jsonb_object_agg(lang, n), '{}'::jsonb) from (
        select coalesce(lang, '?') as lang, count(distinct session) as n from public.visits where at > since group by 1
      ) c
    )
  ) into out;
  return out;
end;
$$;
revoke all on function public.admin_analytics(integer) from public, anon;
grant execute on function public.admin_analytics(integer) to authenticated;

-- old visits go every night
do $$
begin
  perform cron.unschedule('clean-visits');
exception when others then
  null;
end;
$$;
select cron.schedule('clean-visits', '17 3 * * *', $$delete from public.visits where at < now() - interval '400 days'$$);
