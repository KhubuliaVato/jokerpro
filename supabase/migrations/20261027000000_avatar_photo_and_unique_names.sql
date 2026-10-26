-- Profile photos (Supabase Storage) and stricter, checkable nickname uniqueness.

alter table public.profiles add column avatar_url text;

-- Together with the unique index on lower(nickname): one name, one player, ignoring case and edge spaces.
alter table public.profiles
  add constraint profiles_nickname_trimmed check (nickname = btrim(nickname));

-- Sign-up trims the name again after cutting it to 16 characters.
create or replace function public.handle_new_user()
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
      nullif(btrim(left(btrim(new.raw_user_meta_data ->> 'nickname'), 16)), ''),
      'მოთამაშე' || substr(new.id::text, 1, 4)
    )
  );
  return new;
end;
$$;

-- Lets the sign-up and edit forms ask "is this name free?" without LIKE wildcards getting in the way.
-- The caller's own current name counts as free.
create function public.nickname_available(n text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select not exists (
    select 1
    from public.profiles p
    where lower(p.nickname) = lower(btrim(n))
      and p.id is distinct from (select auth.uid())
  );
$$;

grant execute on function public.nickname_available(text) to anon, authenticated;

-- Public bucket: photos are shown to everybody, but only the owner can write inside their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 524288, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "players upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "players replace their own avatar"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "players delete their own avatar"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Uploading with upsert needs to see the player's own existing object (public URLs do not depend on this).
create policy "players see their own avatar object"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
