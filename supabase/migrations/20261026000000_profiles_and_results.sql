-- Player profiles and finished-game history for the games hub.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null,
  avatar_color text not null default 'amber',
  avatar_icon text not null default '♠',
  created_at timestamptz not null default now(),
  constraint profiles_nickname_length check (char_length(nickname) between 2 and 16)
);

-- Nicknames are unique regardless of case.
create unique index profiles_nickname_key on public.profiles (lower(nickname));

alter table public.profiles enable row level security;

create policy "profiles are visible to everyone"
  on public.profiles for select
  using (true);

create policy "players edit their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- A profile is created automatically at sign-up, from the nickname given in the sign-up form.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, nickname)
  values (
    new.id,
    coalesce(
      nullif(left(trim(new.raw_user_meta_data ->> 'nickname'), 16), ''),
      'მოთამაშე' || substr(new.id::text, 1, 4)
    )
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- One row per finished game.
create table public.game_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  game text not null default 'joker',
  format text not null,
  hands integer not null,
  place integer not null check (place between 1 and 4),
  score integer not null,
  -- Final scores of all four seats, you first.
  scores jsonb not null,
  played_at timestamptz not null default now()
);

create index game_results_user_played_idx on public.game_results (user_id, played_at desc);

alter table public.game_results enable row level security;

create policy "players read their own results"
  on public.game_results for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "players save their own results"
  on public.game_results for insert
  to authenticated
  with check ((select auth.uid()) = user_id);
