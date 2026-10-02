create table if not exists public.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.snippets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists snippets_user_id_updated_at_idx
  on public.snippets (user_id, updated_at desc);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.user_profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.user_profiles.avatar_url),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of email, raw_user_meta_data on auth.users
  for each row execute function public.handle_new_user();

alter table public.user_profiles enable row level security;
alter table public.snippets enable row level security;

drop policy if exists "Users can read their own profile" on public.user_profiles;
create policy "Users can read their own profile"
  on public.user_profiles for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users can update their own profile" on public.user_profiles;
create policy "Users can update their own profile"
  on public.user_profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Users can read their own snippets" on public.snippets;
create policy "Users can read their own snippets"
  on public.snippets for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own snippets" on public.snippets;
create policy "Users can create their own snippets"
  on public.snippets for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own snippets" on public.snippets;
create policy "Users can update their own snippets"
  on public.snippets for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own snippets" on public.snippets;
create policy "Users can delete their own snippets"
  on public.snippets for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, update on public.user_profiles to authenticated;
grant select, insert, update, delete on public.snippets to authenticated;

alter table public.user_profiles replica identity full;
alter table public.snippets replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_profiles'
  ) then
    execute 'alter publication supabase_realtime add table public.user_profiles';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'snippets'
  ) then
    execute 'alter publication supabase_realtime add table public.snippets';
  end if;
end;
$$;