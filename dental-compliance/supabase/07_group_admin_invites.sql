-- Group Admins can invite Principals, Practice Managers and Staff into practices in their group.
-- Run once in the Supabase SQL editor (already included in 01_schema.sql for new installs).
drop policy if exists invites_insert on public.invites;
create policy invites_insert on public.invites for insert to authenticated with check (
  public.auth_role() = 'platform_admin'
  or (public.auth_role() = 'principal' and practice_id = public.auth_practice_id()
      and role in ('staff','practice_manager','inspector'))
  or (public.auth_role() = 'practice_manager' and practice_id = public.auth_practice_id()
      and role = 'staff')
  or (public.auth_role() = 'group_admin' and role in ('principal','practice_manager','staff')
      and practice_id is not null and public.is_group_admin_of(practice_id)));
