-- A server clock for the online tables, and a log of errors.
--
-- Until now a running table moved only while somebody's browser asked the game server to (bots' turns, the
-- pauses between tricks, the turn timers). If everybody closed the page the table froze. Now a cron job asks the
-- game server every 30 seconds to look at the tables that have stood still (`action: "sweep"`), and close the
-- ones nobody is playing. The job calls the server only when there is a table that has been idle for 10 seconds.
--
-- Errors of the browsers and of the game server are written to `error_log` (the admin panel reads them).

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------------------------------
-- Settings only the server reads: the address of the game server and the key the clock shows it.

create table if not exists public.server_settings (
  key text primary key,
  value text not null
);
alter table public.server_settings enable row level security;
-- (no policy: only the functions below and the game server (service role) read it)

insert into public.server_settings (key, value) values ('sweep_key', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (key) do nothing;
-- The address of the Edge Function `joker` of this project; change it if the project is ever moved.
insert into public.server_settings (key, value) values ('joker_url', 'https://domacyytensyjoguxrwd.supabase.co/functions/v1/joker')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------------------------
-- Errors

create table if not exists public.error_log (
  id bigint generated always as identity primary key,
  source text not null check (source in ('client', 'server')),
  message text not null,
  detail jsonb not null default '{}'::jsonb,
  url text,
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists error_log_created_idx on public.error_log (created_at desc);
alter table public.error_log enable row level security;
-- (no policy: written through log_error / by the game server, read by the admin panel)

create or replace function public.log_error(p_message text, p_detail jsonb default '{}'::jsonb, p_url text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  msg text := left(btrim(coalesce(p_message, '')), 500);
  detail jsonb := coalesce(p_detail, '{}'::jsonb);
begin
  if msg = '' then
    return;
  end if;
  if length(detail::text) > 4000 then
    detail := jsonb_build_object('truncated', true);
  end if;
  -- a flood (a loop in somebody's browser) must not fill the table
  if (select count(*) from public.error_log where source = 'client' and created_at > now() - interval '10 minutes') > 300 then
    return;
  end if;
  insert into public.error_log (source, message, detail, url, user_id)
  values ('client', msg, detail, left(p_url, 300), (select auth.uid()));
end;
$$;
revoke all on function public.log_error(text, jsonb, text) from public;
grant execute on function public.log_error(text, jsonb, text) to anon, authenticated;

create or replace function public.admin_errors(p_limit integer default 60)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  out jsonb;
begin
  perform public.admin_guard();
  select coalesce(jsonb_agg(to_jsonb(r) order by r.last desc), '[]'::jsonb) into out from (
    select
      source, message, count(*) as n, max(created_at) as last, min(created_at) as first,
      (array_agg(url order by created_at desc))[1] as url,
      (array_agg(detail order by created_at desc))[1] as detail,
      count(distinct user_id) as users
    from public.error_log
    where created_at > now() - interval '14 days'
    group by source, message
    order by max(created_at) desc
    limit least(greatest(coalesce(p_limit, 60), 1), 200)
  ) r;
  return out;
end;
$$;

create or replace function public.admin_clear_errors()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.admin_guard();
  delete from public.error_log;
  perform public.admin_note('errors-clear', null, '{}'::jsonb);
end;
$$;
revoke all on function public.admin_errors(integer), public.admin_clear_errors() from public, anon;
grant execute on function public.admin_errors(integer), public.admin_clear_errors() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- The clock

create or replace function public.sweep_tables()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  key text;
  url text;
begin
  -- old errors go
  delete from public.error_log where created_at < now() - interval '14 days';

  -- only when a table that is being played has stood still for 10 seconds
  if not exists (
    select 1
    from public.game_tables g
    join public.table_games t on t.table_id = g.id
    where g.status = 'playing' and t.updated_at < now() - interval '10 seconds'
  ) then
    return;
  end if;

  select value into key from public.server_settings where server_settings.key = 'sweep_key';
  select value into url from public.server_settings where server_settings.key = 'joker_url';
  if key is null or url is null then
    return;
  end if;

  perform net.http_post(
    url := url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-sweep-key', key),
    body := jsonb_build_object('action', 'sweep'),
    timeout_milliseconds := 25000
  );
end;
$$;
revoke all on function public.sweep_tables() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule('sweep-tables');
exception when others then
  null;
end;
$$;
select cron.schedule('sweep-tables', '30 seconds', 'select public.sweep_tables()');
