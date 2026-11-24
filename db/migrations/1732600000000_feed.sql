-- Up Migration

-- The public feed shows only ready + published videos, newest first.
create index videos_feed_idx on videos (created_at desc, id desc)
  where status = 'ready' and publish_status = 'published';

-- The feed is public, so a new upload must not appear in it until its owner chooses to publish.
alter table videos alter column publish_status set default 'unpublished';

-- Down Migration
alter table videos alter column publish_status set default 'published';
drop index videos_feed_idx;
