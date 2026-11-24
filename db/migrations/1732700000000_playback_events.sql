-- Up Migration

-- Raw events from the feed SDK. Dashboards are computed from these with SQL.
-- No foreign key to videos: events stay countable after a video is deleted.
create table playback_events (
  id          bigserial primary key,
  received_at timestamptz not null default now(),
  occurred_at timestamptz not null,
  type        text not null,
  item_id     uuid not null,
  view_id     text not null,
  session_id  text not null,
  network     text,
  device      text not null,
  sdk         text not null,
  data        jsonb not null default '{}'
);

create index playback_events_item_idx on playback_events (item_id, type, occurred_at desc);
create index playback_events_view_idx on playback_events (view_id);

-- Down Migration
drop table playback_events;
