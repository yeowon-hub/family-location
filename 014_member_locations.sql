-- 가족 위치 공유 앱 — Supabase 스키마
-- Supabase 대시보드 → SQL Editor → New query → 전체 붙여넣기 → Run

-- 1. 테이블
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (household_id, user_id),
  unique (user_id)
);

create table if not exists public.member_locations (
  user_id uuid primary key references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  accuracy double precision,
  sharing_enabled boolean not null default true,
  display_name text,
  updated_at timestamptz not null default now()
);

-- 2. 헬퍼
create or replace function public.my_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id
  from public.household_members
  where user_id = auth.uid()
  limit 1;
$$;

create or replace function public.generate_invite_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..8 loop
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;
  return result;
end;
$$;

-- 3. RPC (앱에서 호출)
create or replace function public.get_my_household()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  result json;
begin
  if uid is null then
    return null;
  end if;

  select json_build_object(
    'id', h.id,
    'name', h.name,
    'invite_code', h.invite_code,
    'role', hm.role,
    'member_count', (
      select count(*)::int
      from public.household_members hm2
      where hm2.household_id = h.id
    )
  )
  into result
  from public.household_members hm
  join public.households h on h.id = hm.household_id
  where hm.user_id = uid
  limit 1;

  return result;
end;
$$;

create or replace function public.create_household(household_name text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  hid uuid;
  code text;
  attempts int := 0;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if exists (select 1 from public.household_members where user_id = uid) then
    raise exception 'Already in a household';
  end if;

  loop
    code := public.generate_invite_code();
    exit when not exists (select 1 from public.households where invite_code = code);
    attempts := attempts + 1;
    if attempts > 20 then
      raise exception 'Could not generate invite code';
    end if;
  end loop;

  insert into public.households (name, invite_code)
  values (coalesce(nullif(trim(household_name), ''), '우리 집'), code)
  returning id into hid;

  insert into public.household_members (household_id, user_id, role)
  values (hid, uid, 'owner');

  return public.get_my_household();
end;
$$;

create or replace function public.join_household(code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  hid uuid;
  cnt int;
  max_members int := 5;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if exists (select 1 from public.household_members where user_id = uid) then
    raise exception 'Already in a household';
  end if;

  select id into hid
  from public.households
  where invite_code = upper(trim(code))
  limit 1;

  if hid is null then
    raise exception 'Invalid invite code';
  end if;

  select count(*) into cnt
  from public.household_members
  where household_id = hid;

  if cnt >= max_members then
    raise exception 'Household is full';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (hid, uid, 'member');

  return public.get_my_household();
end;
$$;

-- 4. RLS
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.member_locations enable row level security;

drop policy if exists households_select_member on public.households;
create policy households_select_member
  on public.households
  for select
  to authenticated
  using (id = public.my_household_id());

drop policy if exists household_members_select_same_household on public.household_members;
create policy household_members_select_same_household
  on public.household_members
  for select
  to authenticated
  using (household_id = public.my_household_id());

drop policy if exists member_locations_select_same_household on public.member_locations;
create policy member_locations_select_same_household
  on public.member_locations
  for select
  to authenticated
  using (household_id = public.my_household_id());

drop policy if exists member_locations_insert_own on public.member_locations;
create policy member_locations_insert_own
  on public.member_locations
  for insert
  to authenticated
  with check (user_id = auth.uid() and household_id = public.my_household_id());

drop policy if exists member_locations_update_own on public.member_locations;
create policy member_locations_update_own
  on public.member_locations
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and household_id = public.my_household_id());

-- 5. 권한
grant usage on schema public to authenticated;
grant select on public.households to authenticated;
grant select on public.household_members to authenticated;
grant select, insert, update on public.member_locations to authenticated;
grant execute on function public.get_my_household() to authenticated;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.join_household(text) to authenticated;

-- 6. Realtime (위치 실시간 갱신)
alter publication supabase_realtime add table public.member_locations;
