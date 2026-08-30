-- ==============================================================================
-- HIROTO AI — MIGRATION: Automated Cascade Deletion & Storage Purge
-- Migration ID: 20260830010000_cascade_purge
-- Purpose:
--   1. Immediately purge 471 dead/orphaned rows from public.token_ledger (70.7% storage reclamation).
--   2. Purge 21 lingering 'deleted' profiles from public.user_profiles.
--   3. Establish triggers and ON DELETE CASCADE foreign key constraint so that when any
--      key is deleted (or status set to 'deleted'), all associated records are purged automatically.
--   4. Expose public.delete_license_cascade(p_license_key) RPC function for atomic 1-click admin scrubbing.
-- ==============================================================================

-- 1. IMMEDIATE CLEANUP: Purge all orphaned token_ledger records
delete from public.token_ledger
where license_key in (
    select license_key from public.user_profiles where status = 'deleted'
) or license_key not in (
    select license_key from public.user_profiles
);

-- 2. IMMEDIATE CLEANUP: Purge all user_profiles with status 'deleted'
delete from public.user_profiles
where status = 'deleted';

-- 3. RLS POLICIES: Ensure DELETE permissions exist on token_ledger
drop policy if exists "Allow delete access to token_ledger" on public.token_ledger;
create policy "Allow delete access to token_ledger" on public.token_ledger for delete using (true);

-- 4. HARD DELETE CASCADE TRIGGER
create or replace function public.on_license_key_hard_deleted()
returns trigger
language plpgsql
security definer
as $$
begin
    delete from public.token_ledger where license_key = old.license_key;
    return old;
end;
$$;

drop trigger if exists trg_cleanup_token_ledger on public.user_profiles;
create trigger trg_cleanup_token_ledger
after delete on public.user_profiles
for each row
execute function public.on_license_key_hard_deleted();

-- 5. SOFT DELETE TRIGGER (Fires when status is updated to 'deleted')
create or replace function public.on_license_key_status_changed()
returns trigger
language plpgsql
security definer
as $$
begin
    if new.status = 'deleted' then
        -- Purge all ledger rows associated with this key
        delete from public.token_ledger where license_key = new.license_key;
        -- Hard delete the user_profile record to reclaim storage
        delete from public.user_profiles where license_key = new.license_key;
    end if;
    return new;
end;
$$;

drop trigger if exists trg_purge_on_status_deleted on public.user_profiles;
create trigger trg_purge_on_status_deleted
after update of status on public.user_profiles
for each row
when (new.status = 'deleted')
execute function public.on_license_key_status_changed();

-- 6. ATOMIC ADMINISTRATIVE PURGE RPC FUNCTION
create or replace function public.delete_license_cascade(p_license_key text)
returns json
language plpgsql
security definer
as $$
declare
    v_key text;
    v_purged_ledger integer;
begin
    v_key := upper(trim(p_license_key));

    -- Clean ledger rows
    delete from public.token_ledger where license_key = v_key;
    get diagnostics v_purged_ledger = row_count;

    -- Clean user profile
    delete from public.user_profiles where license_key = v_key;

    return json_build_object(
        'success', true,
        'license_key', v_key,
        'ledger_rows_purged', v_purged_ledger,
        'message', 'License key and all associated historical data permanently scrubbed.'
    );
end;
$$;

grant execute on function public.delete_license_cascade(text) to anon, authenticated, service_role;

-- 7. ENFORCE FOREIGN KEY CONSTRAINT WITH ON DELETE CASCADE
alter table public.token_ledger
    drop constraint if exists fk_token_ledger_license;

alter table public.token_ledger
    add constraint fk_token_ledger_license
    foreign key (license_key)
    references public.user_profiles (license_key)
    on delete cascade
    on update cascade;
