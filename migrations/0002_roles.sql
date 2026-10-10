create table if not exists profiles (
  user_id text primary key references "user" ("id") on delete cascade,
  role text not null check (role in ('klien', 'jastiper', 'admin')),
  created_at timestamptz not null default now()
);

-- Satu admin: orang pertama yang mengklaim menjadi pengembang.
create unique index if not exists profiles_one_admin_idx
  on profiles ((true))
  where role = 'admin';

create table if not exists titipan (
  id text primary key,
  user_id text not null references "user" ("id") on delete cascade,
  arah text not null check (arah in ('cgk-ist', 'ist-cgk')),
  nama text not null,
  kg numeric not null,
  catatan text not null default '',
  status text not null default 'baru' check (status in ('baru', 'dibawa', 'selesai')),
  created_at timestamptz not null default now()
);

create index if not exists titipan_user_id_idx on titipan (user_id);
create index if not exists titipan_status_idx on titipan (status);
