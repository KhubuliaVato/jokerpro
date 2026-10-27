# Supabase

1. Run `migrations/*.sql` in the project's SQL editor (or with the Supabase CLI).
2. Create `.env.local` in the project root:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Both values are public (the key is the *publishable* one, never the service-role key).
3. Authentication → Providers → Email: for development you can turn off "Confirm email",
   otherwise new players must confirm their address before the first sign-in.

## Online play, ratings and the game server

- Migrations in `migrations/` are applied in order (profiles, results, avatars, tables, ranked play, active table).
- The game server is the Edge Function `joker` (`functions/joker/index.ts`). It is bundled into one file with
  `npm run build:functions` (output: `functions/joker/dist/index.js`) and deployed under the name `joker`.
- **The rating formula is private.** It lives in `lib/secret/` (listed in `.gitignore`, never pushed). The deployed
  bundle contains it; a fresh clone cannot rebuild the function without that folder. Keep a backup of `lib/secret/`.
- Checks against the live project (need the four test accounts `jokerpro.sim0..3@example.com`):
  `npm run sim:ranked` (matchmaking) and `npm run sim:online -- nine <code>` (plays a table to the end).
