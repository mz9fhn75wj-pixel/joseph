-- 修仙伴讀雲端同步資料表與 RLS
create table if not exists public.cloud_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  music_settings jsonb,
  updated_at timestamptz not null default now()
);

alter table public.cloud_saves enable row level security;
create policy "users can read their own save" on public.cloud_saves for select using (auth.uid() = user_id);
create policy "users can create their own save" on public.cloud_saves for insert with check (auth.uid() = user_id);
create policy "users can update their own save" on public.cloud_saves for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.cloud_music (
  user_id uuid references auth.users(id) on delete cascade not null,
  track_id text not null,
  name text not null,
  created_at bigint not null,
  storage_path text not null,
  primary key (user_id, track_id)
);

alter table public.cloud_music enable row level security;
create policy "users can read their own music" on public.cloud_music for select using (auth.uid() = user_id);
create policy "users can create their own music" on public.cloud_music for insert with check (auth.uid() = user_id);
create policy "users can update their own music" on public.cloud_music for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users can delete their own music" on public.cloud_music for delete using (auth.uid() = user_id);

insert into storage.buckets (id, name, public) values ('music', 'music', false) on conflict (id) do nothing;
create policy "users can read their own music files" on storage.objects for select using (bucket_id = 'music' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users can upload their own music files" on storage.objects for insert with check (bucket_id = 'music' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users can update their own music files" on storage.objects for update using (bucket_id = 'music' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users can delete their own music files" on storage.objects for delete using (bucket_id = 'music' and (storage.foldername(name))[1] = auth.uid()::text);

