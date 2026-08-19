-- niche_lookups: raw-data cache for YouTube + Trends pulls
-- One row per search term. Cached to avoid burning YouTube Data API quota
-- (search.list costs 100 units per call; free tier is 10,000 units/day).

create table if not exists niche_lookups (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  normalized_query text not null, -- lowercased/trimmed, used for cache lookups
  youtube_raw jsonb,
  trends_raw jsonb,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_by uuid references auth.users(id)
);

create index if not exists niche_lookups_normalized_query_idx
  on niche_lookups (normalized_query);

create index if not exists niche_lookups_expires_at_idx
  on niche_lookups (expires_at);

alter table niche_lookups enable row level security;

-- Users can only read their own cached lookups.
-- (Swap this for a shared/public cache policy later if you want
-- cross-user cache hits to save quota — worth doing once you have
-- more than a couple users, since two people searching "cooking"
-- shouldn't burn quota twice.)
create policy "Users can read own lookups"
  on niche_lookups for select
  using (auth.uid() = created_by);

create policy "Users can insert own lookups"
  on niche_lookups for insert
  with check (auth.uid() = created_by);