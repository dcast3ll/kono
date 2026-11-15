-- Kono Notes initial schema: profiles, notes, indexes, triggers, RLS.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  timezone text not null default 'America/Bogota',
  global_pin_hash text,
  pin_failed_attempts integer not null default 0,
  pin_locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  note_date date not null,
  type text not null check (type in ('IDEA', 'PRIVATE', 'CHECKLIST', 'WORK')),
  title text,
  content jsonb not null default '{}'::jsonb,
  is_private boolean not null default false,
  duration_mins integer generated always as ((content ->> 'duration_mins')::integer) stored,
  search_vector tsvector generated always as (
    to_tsvector('simple'::regconfig, coalesce(title, '') || ' ' || coalesce(content::text, ''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notes_private_flag_matches_type check (is_private = (type = 'PRIVATE'))
);

create index if not exists notes_user_date_idx on public.notes (user_id, note_date, created_at);
create index if not exists notes_work_duration_idx on public.notes (user_id, note_date) where type = 'WORK';
create index if not exists notes_search_idx on public.notes using gin (search_vector);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists notes_set_updated_at on public.notes;
create trigger notes_set_updated_at
before update on public.notes
for each row execute function public.set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.notes enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
for select to authenticated
using (id = (select auth.uid()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

drop policy if exists notes_select_own on public.notes;
create policy notes_select_own on public.notes
for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists notes_insert_own on public.notes;
create policy notes_insert_own on public.notes
for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists notes_update_own on public.notes;
create policy notes_update_own on public.notes
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists notes_delete_own on public.notes;
create policy notes_delete_own on public.notes
for delete to authenticated
using (user_id = (select auth.uid()));

revoke all on public.notes from anon;
revoke all on public.profiles from anon;
grant select, insert, update, delete on public.notes to authenticated;
grant select, update on public.profiles to authenticated;
