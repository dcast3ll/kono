-- Least-privilege grants for API roles.
-- Supabase default privileges grant ALL on new tables to anon/authenticated;
-- TRUNCATE is table-level and not filtered by RLS, so revoke and re-grant.

revoke all on public.notes from anon, authenticated;
revoke all on public.profiles from anon, authenticated;
revoke all on public.schema_migrations from anon, authenticated;

grant select, insert, update, delete on public.notes to authenticated;
grant select, update on public.profiles to authenticated;

grant all on public.notes to service_role;
grant all on public.profiles to service_role;
