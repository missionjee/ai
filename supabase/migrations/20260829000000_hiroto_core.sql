-- ==============================================================================
-- HIROTO AI — SUPABASE DATABASE SCHEMA MIGRATION
-- Project Ref: fvmbqikdomcjalladwmz
-- ==============================================================================

create extension if not exists "uuid-ossp";

create table if not exists public.user_profiles (
    id uuid primary key default gen_random_uuid(),
    license_key text unique not null,
    tokens_balance integer not null default 100 check (tokens_balance >= 0),
    active_device_id text,
    device_name text,
    last_login_at timestamptz default now(),
    last_active_at timestamptz default now(),
    role text not null default 'user',
    status text not null default 'active',
    expires_at timestamptz default (now() + interval '30 days'),
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create index if not exists idx_profiles_license on public.user_profiles (license_key);
create index if not exists idx_profiles_device on public.user_profiles (active_device_id);

create table if not exists public.token_ledger (
    id bigserial primary key,
    license_key text not null,
    period_number text not null,
    prediction_type text,
    tokens_deducted integer not null default 1,
    device_id text not null,
    created_at timestamptz default now()
);

create index if not exists idx_ledger_license on public.token_ledger (license_key);
create index if not exists idx_ledger_period on public.token_ledger (period_number);

create or replace function public.auth_license_device(
    p_license_key text,
    p_device_id text,
    p_device_name text default 'Browser'
)
returns json
language plpgsql
security definer
as $$
declare
    v_user record;
begin
    select * into v_user 
    from public.user_profiles 
    where license_key = upper(trim(p_license_key));

    if not found then
        return json_build_object(
            'success', false,
            'code', 'KEY_NOT_FOUND',
            'message', 'Invalid license key. Please check and retry.'
        );
    end if;

    if v_user.status = 'revoked' then
        return json_build_object(
            'success', false,
            'code', 'KEY_REVOKED',
            'message', 'This license key has been revoked by administration.'
        );
    end if;

    if v_user.expires_at is not null and v_user.expires_at < now() then
        return json_build_object(
            'success', false,
            'code', 'KEY_EXPIRED',
            'message', 'This license key has expired.'
        );
    end if;

    update public.user_profiles
    set 
        active_device_id = p_device_id,
        device_name = coalesce(p_device_name, device_name),
        last_login_at = now(),
        last_active_at = now(),
        updated_at = now()
    where license_key = upper(trim(p_license_key))
    returning * into v_user;

    return json_build_object(
        'success', true,
        'license_key', v_user.license_key,
        'tokens_balance', v_user.tokens_balance,
        'active_device_id', v_user.active_device_id,
        'status', v_user.status,
        'expires_at', v_user.expires_at
    );
end;
$$;

create or replace function public.verify_single_device(
    p_license_key text,
    p_device_id text
)
returns json
language plpgsql
security definer
as $$
declare
    v_user record;
begin
    select * into v_user 
    from public.user_profiles 
    where license_key = upper(trim(p_license_key));

    if not found then
        return json_build_object('valid', false, 'reason', 'KEY_NOT_FOUND');
    end if;

    if v_user.status <> 'active' then
        return json_build_object('valid', false, 'reason', 'INACTIVE');
    end if;

    if v_user.active_device_id is not null and v_user.active_device_id <> p_device_id then
        return json_build_object(
            'valid', false, 
            'reason', 'DEVICE_MISMATCH',
            'message', 'Session terminated. Your account was logged in from another device.'
        );
    end if;

    update public.user_profiles
    set last_active_at = now()
    where license_key = upper(trim(p_license_key));

    return json_build_object(
        'valid', true,
        'tokens_balance', v_user.tokens_balance
    );
end;
$$;

create or replace function public.consume_prediction_token(
    p_license_key text,
    p_device_id text,
    p_period text,
    p_prediction_type text default null
)
returns json
language plpgsql
security definer
as $$
declare
    v_user record;
    v_already_consumed boolean;
begin
    select * into v_user 
    from public.user_profiles 
    where license_key = upper(trim(p_license_key))
    for update;

    if not found then
        return json_build_object('success', false, 'error', 'KEY_NOT_FOUND');
    end if;

    if v_user.active_device_id is not null and v_user.active_device_id <> p_device_id then
        return json_build_object(
            'success', false, 
            'error', 'DEVICE_MISMATCH',
            'message', 'Your account has been accessed from another device.'
        );
    end if;

    select exists (
        select 1 from public.token_ledger 
        where license_key = upper(trim(p_license_key)) 
          and period_number = p_period
    ) into v_already_consumed;

    if v_already_consumed then
        return json_build_object(
            'success', true,
            'deducted', 0,
            'tokens_balance', v_user.tokens_balance,
            'message', 'Period already unlocked'
        );
    end if;

    if v_user.tokens_balance < 1 then
        return json_build_object(
            'success', false,
            'error', 'INSUFFICIENT_TOKENS',
            'tokens_balance', 0,
            'message', 'Your token balance is empty. Recharge tokens to view next prediction.'
        );
    end if;

    update public.user_profiles
    set 
        tokens_balance = tokens_balance - 1,
        last_active_at = now(),
        updated_at = now()
    where license_key = upper(trim(p_license_key))
    returning * into v_user;

    insert into public.token_ledger (license_key, period_number, prediction_type, tokens_deducted, device_id)
    values (upper(trim(p_license_key)), p_period, p_prediction_type, 1, p_device_id);

    return json_build_object(
        'success', true,
        'deducted', 1,
        'tokens_balance', v_user.tokens_balance
    );
end;
$$;

create or replace function public.credit_user_tokens(
    p_license_key text,
    p_token_amount integer
)
returns json
language plpgsql
security definer
as $$
declare
    v_new_balance integer;
begin
    update public.user_profiles
    set 
        tokens_balance = tokens_balance + p_token_amount,
        updated_at = now()
    where license_key = upper(trim(p_license_key))
    returning tokens_balance into v_new_balance;

    if not found then
        return json_build_object('success', false, 'error', 'KEY_NOT_FOUND');
    end if;

    return json_build_object(
        'success', true, 
        'new_balance', v_new_balance
    );
end;
$$;

alter table public.user_profiles enable row level security;
alter table public.token_ledger enable row level security;

create policy "Allow read access to user_profiles" on public.user_profiles for select using (true);
create policy "Allow insert access to user_profiles" on public.user_profiles for insert with check (true);
create policy "Allow update access to user_profiles" on public.user_profiles for update using (true);
create policy "Allow delete access to user_profiles" on public.user_profiles for delete using (true);

create policy "Allow read access to token_ledger" on public.token_ledger for select using (true);
create policy "Allow insert access to token_ledger" on public.token_ledger for insert with check (true);

grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all routines in schema public to anon, authenticated;
