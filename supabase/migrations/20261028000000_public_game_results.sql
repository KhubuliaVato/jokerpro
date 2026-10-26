-- Players can look each other up and see their stats, so finished games are readable by everybody.
-- Writing stays limited to the owner (insert policy is unchanged; there is no update/delete policy).
drop policy "players read their own results" on public.game_results;

create policy "game results are visible to everyone"
  on public.game_results for select
  to anon, authenticated
  using (true);
