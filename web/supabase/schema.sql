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
