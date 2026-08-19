import { NextRequest, NextResponse } from 'next/server';
import { fetchYouTubeNicheData, YouTubeAPIError } from '@/lib/youtube';
import { getSupabaseServerClient } from '@/lib/supabase-server';

const CACHE_TTL_DAYS = 7;

function normalizeQuery(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * GET /api/niche?q=<search term>
 *
 * Step 1-2 milestone: returns RAW YouTube data for a search term.
 * No scoring, no Trends data yet — those get layered in as separate
 * steps once this pipeline is proven solid.
 *
 * Cache-first: checks Supabase for a non-expired lookup before
 * spending YouTube API quota.
 */
export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q');

  if (!query || query.trim().length < 2) {
    return NextResponse.json(
      { error: 'Query param "q" is required (min 2 characters).' },
      { status: 400 }
    );
  }

  const normalizedQuery = normalizeQuery(query);
  const supabase = getSupabaseServerClient();

  // 1. Check cache first
  const { data: cached, error: cacheError } = await supabase
    .from('niche_lookups')
    .select('*')
    .eq('normalized_query', normalizedQuery)
    .gt('expires_at', new Date().toISOString())
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cacheError) {
    // Don't fail the whole request over a cache read error — log and
    // fall through to a live fetch. Cache is an optimization, not a
    // dependency.
    console.error('Cache read error:', cacheError);
  }

  if (cached) {
    return NextResponse.json({
      source: 'cache',
      fetchedAt: cached.fetched_at,
      data: cached.youtube_raw,
    });
  }

  // 2. No valid cache entry — fetch live from YouTube
  let liveData;
  try {
    liveData = await fetchYouTubeNicheData(query);
  } catch (err) {
    if (err instanceof YouTubeAPIError) {
      return NextResponse.json(
        { error: err.message, status: err.status },
        { status: err.status ?? 502 }
      );
    }
    console.error('Unexpected error fetching YouTube data:', err);
    return NextResponse.json(
      { error: 'Unexpected error fetching niche data.' },
      { status: 500 }
    );
  }

  // 3. Write to cache (best-effort — don't fail the response if this fails)
  const expiresAt = new Date(
    Date.now() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { error: insertError } = await supabase.from('niche_lookups').insert({
    query,
    normalized_query: normalizedQuery,
    youtube_raw: liveData,
    fetched_at: liveData.fetchedAt,
    expires_at: expiresAt,
  });

  if (insertError) {
    console.error('Cache write error:', insertError);
  }

  return NextResponse.json({
    source: 'live',
    fetchedAt: liveData.fetchedAt,
    data: liveData,
  });
}
