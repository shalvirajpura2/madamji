-- run once in the supabase sql editor

create table if not exists students (
  id text primary key,
  name text not null,
  grade int not null,
  facts jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists progress (
  student_id text not null references students (id) on delete cascade,
  chapter_id text not null,
  sections_done int not null default 0,
  sections int not null default 0,
  completed boolean not null default false,
  correct int not null default 0,
  attempted int not null default 0,
  recap text not null default '',
  updated_at timestamptz not null default now(),
  primary key (student_id, chapter_id)
);

create table if not exists alerts (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  student_id text,
  student_name text,
  chapter_id text,
  severity text not null,
  category text not null default '',
  summary text not null default '',
  quote text not null default '',
  source text not null default 'teacher'
);

-- one row per class: what the engine asked for, what the teacher said, tools and results
create table if not exists transcripts (
  id text primary key,
  student_id text,
  chapter_id text,
  chapter_version text,
  started_at timestamptz not null default now(),
  data jsonb not null
);

-- the app only uses the service role key on the server, so lock tables to everyone else
alter table students enable row level security;
alter table progress enable row level security;
alter table alerts enable row level security;
alter table transcripts enable row level security;

-- ---------------------------------------------------------------------------------------------
-- sign-in, free trial, rate limits and the staff activity log. safe to run again.

alter table students add column if not exists email text not null default '';

-- one row per class started. id is the livekit room name, the same id as transcripts.id
create table if not exists class_sessions (
  id text primary key,
  student_id text not null,
  student_name text not null default '',
  email text not null default '',
  ip text not null default '',
  user_agent text not null default '',
  chapter_id text not null,
  minutes int not null,
  -- started | finished | failed (failed = dropped in the first minute, does not use up the trial)
  status text not null default 'started',
  -- a rejoin after a dropped class points at the class it continues and does not count again
  trial_of text references class_sessions (id) on delete set null,
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds int,
  sections_done int,
  sections int,
  completed boolean,
  error text
);
create index if not exists class_sessions_student on class_sessions (student_id);
create index if not exists class_sessions_ip on class_sessions (ip, created_at);
create index if not exists class_sessions_created on class_sessions (created_at desc);

-- everything worth knowing for the staff dashboard: sign-ups, classes, blocks
create table if not exists activity (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null,
  student_id text not null default '',
  email text not null default '',
  ip text not null default '',
  detail jsonb not null default '{}'
);
create index if not exists activity_created on activity (created_at desc);

-- fixed-window counters for rate limits, shared by every server instance
create table if not exists rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (key, window_start)
);

alter table class_sessions enable row level security;
alter table activity enable row level security;
alter table rate_limits enable row level security;

-- add hits for key (0 just reads it) and return how many hits it has in this window
create or replace function rate_limit_hit(p_key text, p_window_seconds int, p_add int default 1)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  n int;
begin
  insert into rate_limits (key, window_start, hits) values (p_key, w, p_add)
  on conflict (key, window_start) do update set hits = rate_limits.hits + p_add
  returning hits into n;
  if random() < 0.01 then
    delete from rate_limits where window_start < now() - interval '2 days';
  end if;
  return n;
end;
$$;

-- start a class if the student still has trial classes of that length left.
-- returns 'ok', 'rejoin' (continues a class from the last few minutes), 'trial_used' or 'ip_limit'
create or replace function claim_class(
  p_id text, p_student text, p_name text, p_email text, p_ip text, p_user_agent text,
  p_chapter text, p_minutes int, p_max_long int, p_max_short int, p_ip_per_day int
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  original text;
  used int;
  ip_used int;
begin
  -- one claim at a time per student, so two tabs can't both take the last class
  perform pg_advisory_xact_lock(hashtext('claim:' || p_student));

  select id into original from class_sessions
  where student_id = p_student and chapter_id = p_chapter and minutes = p_minutes
    and trial_of is null and status <> 'failed'
    and created_at > now() - make_interval(mins => p_minutes + 5)
  order by created_at desc limit 1;

  if original is not null then
    insert into class_sessions (id, student_id, student_name, email, ip, user_agent, chapter_id, minutes, trial_of)
    values (p_id, p_student, p_name, p_email, p_ip, p_user_agent, p_chapter, p_minutes, original);
    return 'rejoin';
  end if;

  select count(*) into used from class_sessions
  where student_id = p_student and trial_of is null and status <> 'failed'
    and (case when p_minutes >= 25 then minutes >= 25 else minutes < 25 end);
  if used >= (case when p_minutes >= 25 then p_max_long else p_max_short end) then
    return 'trial_used';
  end if;

  if p_ip_per_day > 0 then
    select count(*) into ip_used from class_sessions
    where ip = p_ip and trial_of is null and status <> 'failed' and created_at > now() - interval '1 day';
    if ip_used >= p_ip_per_day then
      return 'ip_limit';
    end if;
  end if;

  insert into class_sessions (id, student_id, student_name, email, ip, user_agent, chapter_id, minutes)
  values (p_id, p_student, p_name, p_email, p_ip, p_user_agent, p_chapter, p_minutes);
  return 'ok';
end;
$$;

-- only the server (service role) may call these
revoke all on function rate_limit_hit(text, int, int) from public, anon, authenticated;
revoke all on function claim_class(text, text, text, text, text, text, text, int, int, int, int) from public, anon, authenticated;
