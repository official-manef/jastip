-- Multi-trip support (docs/rencana-omzet-trip.md §4, §7 stage 3).
--
-- Before: one trip per user, pk on user_id. After: many trips per user, each
-- with a stable id and an optimistic-concurrency `version`. Ownership is
-- enforced in the API; the FK keeps rows tied to a real account.
--
-- The old single-row scheme keeps working: `slug` is unique per owner, so the
-- UI's "current trip" is just a slug lookup.

alter table trip_scenarios
  add column if not exists id text,
  add column if not exists slug text,
  add column if not exists name text,
  add column if not exists version bigint not null default 1;

-- Backfill existing single-trip rows before tightening the pk.
update trip_scenarios
  set id = coalesce(id, 'trip-' || md5(random()::text || clock_timestamp()::text)),
      slug = coalesce(slug, 'utama'),
      name = coalesce(name, 'Trip utama')
  where id is null or slug is null or name is null;

alter table trip_scenarios alter column id set not null;
alter table trip_scenarios alter column slug set not null;

-- Swap the primary key from user_id to (user_id, slug); `id` is a stable handle
-- the API uses, slug is the readable per-owner key.
alter table trip_scenarios drop constraint if exists trip_scenarios_pkey;
alter table trip_scenarios add primary key (user_id, slug);

create unique index if not exists trip_scenarios_id_idx on trip_scenarios (user_id, id);
