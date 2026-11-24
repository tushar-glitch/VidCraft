-- Up Migration
create type video_status as enum ('awaiting_upload', 'queued', 'processing', 'ready', 'failed');
create type publish_status as enum ('unpublished', 'published');

create table videos (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users (id) on delete cascade,
  title          text not null,
  status         video_status not null default 'awaiting_upload',
  progress       smallint not null default 0 check (progress between 0 and 100),
  publish_status publish_status not null default 'published',
  source_name    text not null,
  source_size    bigint not null,
  source_key     text not null,
  duration_sec   real,
  width          integer,
  height         integer,
  renditions     jsonb not null default '[]',
  hls_key        text,        -- master playlist, in the public media bucket
  thumbnail_key  text,
  error          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index videos_user_created_idx on videos (user_id, created_at desc);

-- Down Migration
drop table videos;
drop type publish_status;
drop type video_status;
