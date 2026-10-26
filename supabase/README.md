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
