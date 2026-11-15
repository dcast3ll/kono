-- Agent note type and per-user agent tokens.

alter table public.notes drop constraint if exists notes_type_check;
alter table public.notes add constraint notes_type_check
  check (type in ('IDEA', 'PRIVATE', 'CHECKLIST', 'WORK', 'AGENT'));

create table if not exists public.agent_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  token_hash text not null unique,
  label text,
  scopes text[] not null default array['notes:read', 'agent:write'],
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists agent_tokens_user_idx on public.agent_tokens (user_id);

alter table public.agent_tokens enable row level security;

drop policy if exists agent_tokens_select_own on public.agent_tokens;
create policy agent_tokens_select_own on public.agent_tokens
for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists agent_tokens_insert_own on public.agent_tokens;
create policy agent_tokens_insert_own on public.agent_tokens
for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists agent_tokens_update_own on public.agent_tokens;
create policy agent_tokens_update_own on public.agent_tokens
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists agent_tokens_delete_own on public.agent_tokens;
create policy agent_tokens_delete_own on public.agent_tokens
for delete to authenticated
using (user_id = (select auth.uid()));

revoke all on public.agent_tokens from anon, authenticated;
grant select, insert, update, delete on public.agent_tokens to authenticated;
grant all on public.agent_tokens to service_role;
