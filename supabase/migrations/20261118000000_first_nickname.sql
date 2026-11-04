-- Signing in with Google / Facebook gives no nickname, so the profile starts with the generated one
-- ('მოთამაშე' + 4 hex digits). The player picks a real name once, free of charge; later changes cost coins as before.

create function public.choose_first_nickname(p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  clean text := btrim(coalesce(p_name, ''));
  current_name text;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if char_length(clean) not between 2 and 16 or clean ~ '^მოთამაშე[0-9a-f]{4}$' then
    raise exception 'bad nickname' using errcode = 'P0001';
  end if;

  select nickname into current_name from public.profiles where id = uid;
  if current_name is null or current_name !~ '^მოთამაშე[0-9a-f]{4}$' then
    raise exception 'nickname already chosen' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.profiles where lower(nickname) = lower(clean) and id <> uid) then
    raise exception 'nickname taken' using errcode = 'P0001';
  end if;

  perform set_config('app.nick_ok', '1', true);
  begin
    update public.profiles set nickname = clean where id = uid;
  exception when unique_violation then
    raise exception 'nickname taken' using errcode = 'P0001';
  end;
end;
$$;

revoke execute on function public.choose_first_nickname(text) from public, anon;
grant execute on function public.choose_first_nickname(text) to authenticated;
