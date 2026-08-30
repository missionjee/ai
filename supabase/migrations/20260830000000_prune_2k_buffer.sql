-- Migration: Upgrade global_signals pruning trigger to 2,000-record non-blocking FIFO ring buffer
create or replace function public.prune_global_signals()
returns trigger
language plpgsql
security definer
as $$
declare
    v_cutoff_issue text;
    v_count integer;
begin
    -- Non-blocking advisory lock: prevents concurrent prune collisions and statement timeouts
    if not pg_try_advisory_xact_lock(749201) then
        return new;
    end if;

    select count(*) into v_count from public.global_signals;
    if v_count > 2000 then
        -- Indexed offset lookup of 2000th issue_number
        select issue_number into v_cutoff_issue
        from public.global_signals
        order by issue_number desc
        offset 2000 limit 1;

        if v_cutoff_issue is not null then
            delete from public.global_signals
            where issue_number < v_cutoff_issue;
        end if;
    end if;
    return new;
end;
$$;

drop trigger if exists trigger_prune_global_signals on public.global_signals;
create trigger trigger_prune_global_signals
after insert on public.global_signals
for each statement
execute function public.prune_global_signals();
