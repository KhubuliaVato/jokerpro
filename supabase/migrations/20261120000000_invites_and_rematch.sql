-- Growth: inviting friends with a link (both get coins once the friend has played), and a rematch at a finished table.
--
-- Invites
--   invite_codes     one short code per player (the link is  /?ref=CODE)
--   referrals        who invited whom; rewarded_at is set when the reward was paid
--   claim_invite()   called once by a new player who came through a link
--   a trigger on game_results pays the reward: after the invited player has finished 3 games of random players
--   (friendly or ranked), they get 100 coins and the inviter 150 (for at most 10 invited friends).
--
-- Rematch
--   rematch(table)   at a finished private table: the first to ask opens a new table with the same rules,
--                    everybody else who asks is seated at that same new table.

alter table public.coin_log drop constraint coin_log_reason_check;
alter table public.coin_log add constraint coin_log_reason_check check (reason in ('win', 'play', 'achievement', 'invite'));

create table public.invite_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code text not null unique
);

alter table public.invite_codes enable row level security;

create policy "players read their own invite code"
  on public.invite_codes for select to authenticated using ((select auth.uid()) = user_id);

create table public.referrals (
  invitee uuid primary key references auth.users (id) on delete cascade,
  inviter uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  rewarded_at timestamptz
);

create index referrals_inviter_idx on public.referrals (inviter);

alter table public.referrals enable row level security;

create policy "the two sides can read a referral"
  on public.referrals for select to authenticated using ((select auth.uid()) in (invitee, inviter));

-- ---------------------------------------------------------------------------------------------

create function public.my_invite_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  found_code text;
  c text;
  i int;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  select code into found_code from public.invite_codes where user_id = uid;
  if found_code is not null then
    return found_code;
  end if;
  loop
    c := '';
    for i in 1..7 loop
      c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    begin
      insert into public.invite_codes (user_id, code) values (uid, c)
      on conflict (user_id) do nothing;
      exit;
    exception when unique_violation then
      null;
    end;
  end loop;
  return (select code from public.invite_codes where user_id = uid);
end;
$$;

revoke execute on function public.my_invite_code() from public, anon;
grant execute on function public.my_invite_code() to authenticated;

-- Remembers who invited the signed-in player. Only a new player counts (a profile of the last 3 days that has
-- not played online yet), only once, and never oneself. Returns whether the invitation was taken.
create function public.claim_invite(p_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  boss uuid;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  select user_id into boss from public.invite_codes where code = upper(btrim(coalesce(p_code, '')));
  if boss is null or boss = uid then
    return false;
  end if;
  if not exists (select 1 from public.profiles where id = uid and created_at > now() - interval '3 days') then
    return false;
  end if;
  if exists (select 1 from public.game_results where user_id = uid and online) then
    return false;
  end if;
  insert into public.referrals (invitee, inviter) values (uid, boss) on conflict (invitee) do nothing;
  return found;
end;
$$;

revoke execute on function public.claim_invite(text) from public, anon;
grant execute on function public.claim_invite(text) to authenticated;

create function public.my_invite_stats()
returns table (code text, invited integer, rewarded integer, earned integer)
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
  return query
    select
      public.my_invite_code(),
      (select count(*)::integer from public.referrals r where r.inviter = uid),
      (select count(*)::integer from public.referrals r where r.inviter = uid and r.rewarded_at is not null),
      coalesce((select sum(l.amount)::integer from public.coin_log l where l.user_id = uid and l.reason = 'invite'), 0);
end;
$$;

revoke execute on function public.my_invite_stats() from public, anon;
grant execute on function public.my_invite_stats() to authenticated;

-- The reward: three finished games of random players. Never allowed to break saving a result.
create function public.pay_referral()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.referrals;
  games integer;
begin
  if not new.online or new.kind not in ('friendly', 'ranked') then
    return new;
  end if;
  select * into r from public.referrals where invitee = new.user_id and rewarded_at is null for update;
  if not found then
    return new;
  end if;
  select count(*) into games from public.game_results
    where user_id = new.user_id and online and kind in ('friendly', 'ranked');
  if games < 3 then
    return new;
  end if;

  update public.referrals set rewarded_at = now() where invitee = r.invitee;
  perform public.grant_coins(r.invitee, 100, 'invite', 'welcome');
  if (select count(*) from public.referrals where inviter = r.inviter and rewarded_at is not null) <= 10 then
    perform public.grant_coins(r.inviter, 150, 'invite', r.invitee::text);
  end if;
  return new;
exception when others then
  return new;
end;
$$;

revoke execute on function public.pay_referral() from public, anon, authenticated;

create trigger game_results_pay_referral
  after insert on public.game_results
  for each row execute function public.pay_referral();

-- ---------------------------------------------------------------------------------------------
-- Rematch

alter table public.game_tables add column rematch_code text;

create function public.rematch(p_table_id uuid)
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
  if not found or prev.kind <> 'private' or prev.status not in ('finished', 'closed') then
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

revoke execute on function public.rematch(uuid) from public, anon;
grant execute on function public.rematch(uuid) to authenticated;
