-- Up Migration
create table users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique, -- stored lowercased by the API
  password_hash text not null,
  first_name    text not null,
  last_name     text not null,
  created_at    timestamptz not null default now()
);

create type job_status as enum ('awaiting_upload', 'queued', 'processing', 'completed', 'failed');

create table jobs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references users (id) on delete cascade, -- null = anonymous upload
  operation    text not null,
  params       jsonb not null,
  status       job_status not null default 'awaiting_upload',
  progress     smallint not null default 0 check (progress between 0 and 100),
  input_name   text not null,
  input_size   bigint not null,
  input_key    text not null,
  output_key   text,
  output_size  bigint,
  error        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  completed_at timestamptz
);

create index jobs_user_created_idx on jobs (user_id, created_at desc);

-- Down Migration
drop table jobs;
drop type job_status;
drop table users;
