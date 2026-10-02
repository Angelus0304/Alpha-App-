# Alpha Business Concepts

Expo application with Google sign-in through Supabase, private user profiles,
private snippets with Postgres realtime updates, and an optional new-user export
to Google Sheets.

## Run locally

```sh
npm install
cp .env.example .env
# Set the Supabase project URL and publishable/anon key in .env
npx expo start --web
```

This repository is an Expo app, not a Vite app. The Expo web runtime is installed
for browser testing; use `npx expo start` for native simulator/device workflows.

## Supabase setup

1. Create a Supabase project and set `EXPO_PUBLIC_SUPABASE_URL` and
   `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env`. Only the publishable/anon key may
   be used in the client; never put a service-role key in an `EXPO_PUBLIC_`
   variable.
2. Apply `supabase/migrations/20261002000000_profiles_snippets.sql` using the
   Supabase SQL editor or Supabase CLI (`npx supabase login`, `npx supabase link`,
   then `npx supabase db push`). The migration creates `user_profiles` and
   `snippets`, installs row-level security policies, adds the new-user profile
   trigger, and adds both tables to `supabase_realtime`.
3. In Supabase Authentication, enable Google and enter the OAuth client ID and
   secret from Google Cloud. Add the Supabase callback URL shown by the provider
   settings to the Google OAuth client's authorized redirect URIs. Add the app
   callback (`alphabusinessconcepts://auth/callback`) and the local web callback
   (`http://localhost:8081/auth/callback`) to Supabase's allowed redirect URLs.

The snippets table currently scopes each user's rows to that user. The realtime
subscription therefore only returns rows permitted by the same RLS policies.

## Google Sheets user export

1. Create a Google Sheet with a `Users` tab and share it with a Google Cloud
   service account that has the Google Sheets API enabled and Editor access.
   The first row is a header: `Supabase user ID`, `Email`, `Name`, `Avatar URL`,
   `Created at`.
2. Set Supabase function secrets `GOOGLE_SERVICE_ACCOUNT_JSON`,
   `GOOGLE_SPREADSHEET_ID`, `GOOGLE_SHEET_NAME` (optional; defaults to `Users`),
   and a long random `SHEETS_WEBHOOK_SECRET`. Do not commit the service account
   JSON or any secret values.
3. Deploy `supabase/functions/sync-new-user` with
   `npx supabase functions deploy sync-new-user`.
4. Create a Database Webhook for `auth.users` INSERT events. Send it to
   `https://<project-ref>.supabase.co/functions/v1/sync-new-user` and add the
   header `x-webhook-secret` with the same `SHEETS_WEBHOOK_SECRET` value.

The function checks the sheet for the Supabase user ID before appending, to
avoid duplicate rows on webhook retries. The webhook and Google credentials
remain server-side.
