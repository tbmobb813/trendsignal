import { NextRequest, NextResponse } from 'next/server';
import { fetchYouTubeNicheData, YouTubeAPIError } from '@/lib/youtube';
import { fetchTrendsData, TrendsAPIError } from '@/lib/trends';
import { getSupabaseServerClient } from '@/lib/supabase-server';

const CACHE_TTL_DAYS = 7;

function normalizeQuery(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * GET /api/niche?q=<search term>
 *
 * Returns RAW YouTube + Trends data for a search term. Still no
 * scoring here — that stays in lib/scoring, operating on this output.
 *
 * Trends and YouTube are fetched independently and a failure in
 * either is reported without failing the whole request — a broken
 * Trends call (see the caveat in lib/trends.ts about it being an
 * unofficial API) shouldn't take down the YouTube data too.
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
    console.error('Cache read error:', cacheError);
  }

  if (cached) {
    return NextResponse.json({
      source: 'cache',
      fetchedAt: cached.fetched_at,
      data: cached.youtube_raw,
      trends: cached.trends_raw,
    });
  }

  // 2. No valid cache entry — fetch live from YouTube and Trends in parallel.
  // Use allSettled, not all: a Trends failure shouldn't sink the YouTube data.
  const [youtubeResult, trendsResult] = await Promise.allSettled([
    fetchYouTubeNicheData(query),
    fetchTrendsData(query),
  ]);

  if (youtubeResult.status === 'rejected') {
    const err = youtubeResult.reason;
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

  const liveData = youtubeResult.value;

  let trendsData = null;
  let trendsWarning: string | null = null;
  if (trendsResult.status === 'fulfilled') {
    trendsData = trendsResult.value;
  } else {
    const err = trendsResult.reason;
    trendsWarning =
      err instanceof TrendsAPIError
        ? `Trends data unavailable: ${err.message}`
        : 'Trends data unavailable due to an unexpected error.';
    console.error('Trends fetch failed (non-fatal):', err);
  }

  // 3. Write to cache (best-effort)
  const expiresAt = new Date(
    Date.now() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { error: insertError } = await supabase.from('niche_lookups').insert({
    query,
    normalized_query: normalizedQuery,
    youtube_raw: liveData,
    trends_raw: trendsData,
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
    trends: trendsData,
    ...(trendsWarning ? { trendsWarning } : {}),
  });
}
