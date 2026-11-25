-- Up Migration
create table webhook_endpoints (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users (id) on delete cascade,
  url        text not null,
  -- Needed in the clear to sign each request. Shown to the owner once, when the endpoint is created.
  secret     text not null,
  created_at timestamptz not null default now()
);
create index webhook_endpoints_user_idx on webhook_endpoints (user_id);

create type webhook_delivery_status as enum ('pending', 'delivered', 'failed');

create table webhook_deliveries (
  id           uuid primary key default gen_random_uuid(),
  endpoint_id  uuid not null references webhook_endpoints (id) on delete cascade,
  event_type   text not null,
  payload      jsonb not null,
  status       webhook_delivery_status not null default 'pending',
  attempts     integer not null default 0,
  last_status  integer,
  last_error   text,
  created_at   timestamptz not null default now(),
  delivered_at timestamptz
);
create index webhook_deliveries_endpoint_idx on webhook_deliveries (endpoint_id, created_at desc);

-- Down Migration
drop table webhook_deliveries;
drop type webhook_delivery_status;
drop table webhook_endpoints;
