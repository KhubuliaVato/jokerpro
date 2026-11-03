-- The level of the bots that fill empty seats of a table (weak / strong / pro), chosen when the game starts
-- from the average rating of the humans at the table.
alter table public.game_tables
  add column bot_tier text not null default 'strong' check (bot_tier in ('weak', 'strong', 'pro'));
