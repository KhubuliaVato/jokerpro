-- players may put on what they own (the profile guard checks ownership); the columns were added without this grant
grant update (equipped_play, equipped_sound) on public.profiles to authenticated;
