create table if not exists trip_books (
  user_id text primary key references "user"(id) on delete cascade,
  book jsonb not null,
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);
