-- Gifts: a player sends an item of their inventory to another player with a short letter.
--
--   gifts                 one row per gift (who, to whom, which item, the letter, and whether the receiver has seen it)
--   send_gift(...)        the only way to give: the item moves from one inventory to the other at once
--   unseen_gifts()        what the signed-in player has not been shown yet (with the sender's nickname)
--   mark_gifts_seen()     the player has been shown them
--
-- The item leaves the sender (it is not copied), so a gift never creates value; whatever the sender wore of it
-- is taken off. A gift cannot go to oneself or to a player who already owns the item.

create table public.gifts (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  item_id text not null references public.shop_items (id),
  message text not null default '' check (char_length(message) <= 300),
  created_at timestamptz not null default now(),
  seen_at timestamptz
);

create index gifts_to_unseen on public.gifts (to_user) where seen_at is null;
create index gifts_from_recent on public.gifts (from_user, created_at desc);

alter table public.gifts enable row level security;

-- Only the two sides can read a gift; nobody writes to it directly.
create policy "the sender and the receiver can read a gift"
  on public.gifts for select to authenticated
  using ((select auth.uid()) in (from_user, to_user));

-- The receiver's page can be told the moment a gift arrives.
alter publication supabase_realtime add table public.gifts;

-- ---------------------------------------------------------------------------------------------

create function public.send_gift(p_to text, p_item text, p_message text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  target uuid;
  letter text := left(btrim(coalesce(p_message, '')), 300);
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  select id into target from public.profiles where lower(nickname) = lower(btrim(coalesce(p_to, '')));
  if target is null then
    raise exception 'no such player' using errcode = 'P0001';
  end if;
  if target = uid then
    raise exception 'cannot gift yourself' using errcode = 'P0001';
  end if;

  -- At most 20 gifts a day, so that nobody is flooded.
  if (select count(*) from public.gifts where from_user = uid and created_at > now() - interval '1 day') >= 20 then
    raise exception 'too many gifts' using errcode = '54000';
  end if;

  -- Lock the giver's row of the item: two gifts of the same item cannot both go through.
  perform 1 from public.user_items where user_id = uid and item_id = p_item for update;
  if not found then
    raise exception 'item not owned' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.user_items where user_id = target and item_id = p_item) then
    raise exception 'receiver already owns it' using errcode = 'P0001';
  end if;

  -- Take it off the giver (the profile guard allows removing, never wearing what is not owned).
  update public.profiles set
    equipped_back  = case when equipped_back  = p_item then null else equipped_back  end,
    equipped_frame = case when equipped_frame = p_item then null else equipped_frame end,
    equipped_name  = case when equipped_name  = p_item then null else equipped_name  end,
    equipped_fx    = case when equipped_fx    = p_item then null else equipped_fx    end
  where id = uid;

  update public.user_items set user_id = target, acquired_at = now()
  where user_id = uid and item_id = p_item;

  insert into public.gifts (from_user, to_user, item_id, message) values (uid, target, p_item, letter);
end;
$$;

revoke execute on function public.send_gift(text, text, text) from public, anon;
grant execute on function public.send_gift(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------------------------

create function public.unseen_gifts()
returns table (id uuid, from_nick text, item_id text, message text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, p.nickname, g.item_id, g.message, g.created_at
  from public.gifts g
  join public.profiles p on p.id = g.from_user
  where g.to_user = (select auth.uid()) and g.seen_at is null
  order by g.created_at;
$$;

revoke execute on function public.unseen_gifts() from public, anon;
grant execute on function public.unseen_gifts() to authenticated;

create function public.mark_gifts_seen()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.gifts set seen_at = now() where to_user = (select auth.uid()) and seen_at is null;
$$;

revoke execute on function public.mark_gifts_seen() from public, anon;
grant execute on function public.mark_gifts_seen() to authenticated;
