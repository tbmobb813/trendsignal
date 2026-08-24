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

-- rate_limits: tracks IP-based rate limiting counts for serverless environments
create table if not exists rate_limits (
  ip text primary key,
  tokens int not null default 5,
  last_refill timestamptz not null default now()
);

-- Service role will bypass RLS. Allow read/write access for rate limit checks.
alter table rate_limits enable row level security;

create policy "Enable update for backend anonymous matching IP"
  on rate_limits for update
  using (true)
  with check (true);

create policy "Enable insert for backend anonymous matching IP"
  on rate_limits for insert
  with check (true);

create policy "Enable select for backend anonymous matching IP"
  on rate_limits for select
  using (true);

-- Atomic decrement function with sliding token bucket refill logic
create or replace function decrement_rate_limit(
  client_ip text,
  bucket_limit int,
  refill_interval_ms int
)
returns boolean
language plpgsql
security definer
as $$
declare
  current_tokens int;
  last_refill_time timestamptz;
  now_time timestamptz := now();
  elapsed_ms float8;
  refill_tokens int;
  new_tokens int;
  remainder_ms float8;
begin
  -- Fetch existing record
  select tokens, last_refill
  into current_tokens, last_refill_time
  from rate_limits
  where ip = client_ip;

  -- Create record if it doesn't exist
  if not found then
    insert into rate_limits (ip, tokens, last_refill)
    values (client_ip, bucket_limit - 1, now_time);
    return false;
  end if;

  -- Calculate refills
  elapsed_ms := extract(epoch from (now_time - last_refill_time)) * 1000.0;
  refill_tokens := floor(elapsed_ms / refill_interval_ms);

  if refill_tokens > 0 then
    new_tokens := least(bucket_limit, current_tokens + refill_tokens);
    remainder_ms := mod(elapsed_ms, refill_interval_ms);
    last_refill_time := now_time - (remainder_ms * interval '1 millisecond');
  else
    new_tokens := current_tokens;
  end if;

  -- Decrement if tokens are available
  if new_tokens > 0 then
    update rate_limits
    set tokens = new_tokens - 1,
        last_refill = last_refill_time
    where ip = client_ip;
    return false;
  end if;

  -- Out of tokens, update refill time if dynamic progression occurred
  if refill_tokens > 0 then
    update rate_limits
    set tokens = 0,
        last_refill = last_refill_time
    where ip = client_ip;
  end if;

  return true;
end;
$$;