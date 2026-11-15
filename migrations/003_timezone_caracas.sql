-- Align the default profile timezone with the primary user's timezone.

alter table public.profiles
  alter column timezone set default 'America/Caracas';

update public.profiles
set timezone = 'America/Caracas'
where timezone = 'America/Bogota';
