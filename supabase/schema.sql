-- ============================================================
-- OSAEK.W 예약 DB 스키마 (Supabase / PostgreSQL)
-- ============================================================
create extension if not exists pgcrypto;

create table if not exists public.booking_settings (
  course text primary key check (course in ('A','B')),
  allowed_dow smallint[] not null default '{}',
  capacity integer not null check (capacity > 0),
  updated_at timestamptz not null default now()
);

insert into public.booking_settings(course, allowed_dow, capacity)
values
  ('A', array[6]::smallint[], 20),
  ('B', array[2,4,5]::smallint[], 15)
on conflict (course) do nothing;

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_no text unique not null,
  course text not null check (course in ('A','B')),
  course_option text default null,
  booking_date date not null,
  people integer not null check (people >= 1 and people <= 20),

  applicant_name text not null,
  applicant_phone text not null,
  applicant_email text not null,
  consent boolean not null default false,

  status text not null default '확정' check (status in ('확정','취소')),

  pet_name text,
  pet_breed text,
  pet_size text,
  pet_vaccinated boolean,
  pet_sociality text,

  nationality text,
  guide_language text,
  hanbok_size text,
  diet_restriction text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_bookings_course_date
  on public.bookings(course, booking_date);

create index if not exists idx_bookings_booking_no
  on public.bookings(booking_no);

create index if not exists idx_bookings_status
  on public.bookings(status);

alter table public.booking_settings enable row level security;
alter table public.bookings enable row level security;

-- 브라우저에서 Supabase를 직접 조회하지 않고 Vercel API를 통해서만 접근합니다.
revoke all on public.booking_settings from anon, authenticated;
revoke all on public.bookings from anon, authenticated;

-- 예약 생성은 같은 날짜/코스의 정원을 트랜잭션 안에서 다시 확인합니다.
create or replace function public.create_booking_atomic(
  p_course text,
  p_course_option text,
  p_booking_date date,
  p_people integer,
  p_applicant_name text,
  p_applicant_phone text,
  p_applicant_email text,
  p_consent boolean,
  p_pet_name text default null,
  p_pet_breed text default null,
  p_pet_size text default null,
  p_pet_vaccinated boolean default null,
  p_pet_sociality text default null,
  p_nationality text default null,
  p_guide_language text default null,
  p_hanbok_size text default null,
  p_diet_restriction text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_setting public.booking_settings%rowtype;
  v_used integer;
  v_booking_no text;
  v_row public.bookings%rowtype;
  v_dow integer;
begin
  if p_course not in ('A','B') then
    raise exception 'INVALID_COURSE';
  end if;

  if p_people is null or p_people < 1 then
    raise exception 'INVALID_PEOPLE';
  end if;

  select * into v_setting
  from public.booking_settings
  where course = p_course;

  if not found then
    raise exception 'SETTING_NOT_FOUND';
  end if;

  v_dow := extract(dow from p_booking_date)::integer;
  if not (v_dow = any(v_setting.allowed_dow)) then
    raise exception 'DATE_NOT_ALLOWED';
  end if;

  -- 같은 코스/날짜 예약은 한 번에 하나씩 정원 계산
  perform pg_advisory_xact_lock(hashtext(p_course || ':' || p_booking_date::text));

  select coalesce(sum(people), 0)::integer
  into v_used
  from public.bookings
  where course = p_course
    and booking_date = p_booking_date
    and status <> '취소';

  if v_used + p_people > v_setting.capacity then
    raise exception 'CAPACITY_FULL';
  end if;

  v_booking_no :=
    'BW-' || to_char(current_date, 'YYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.bookings (
    booking_no, course, course_option, booking_date, people,
    applicant_name, applicant_phone, applicant_email, consent, status,
    pet_name, pet_breed, pet_size, pet_vaccinated, pet_sociality,
    nationality, guide_language, hanbok_size, diet_restriction
  ) values (
    v_booking_no, p_course, nullif(p_course_option,''), p_booking_date, p_people,
    p_applicant_name, p_applicant_phone, p_applicant_email, p_consent, '확정',
    p_pet_name, p_pet_breed, p_pet_size, p_pet_vaccinated, p_pet_sociality,
    p_nationality, p_guide_language, p_hanbok_size, p_diet_restriction
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.create_booking_atomic(
  text,text,date,integer,text,text,text,boolean,
  text,text,text,boolean,text,text,text,text,text
) from public, anon, authenticated;

grant execute on function public.create_booking_atomic(
  text,text,date,integer,text,text,text,boolean,
  text,text,text,boolean,text,text,text,text,text
) to service_role;
