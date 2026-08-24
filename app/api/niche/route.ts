import { NextRequest, NextResponse } from 'next/server';
import { fetchYouTubeNicheData, YouTubeAPIError, YouTubeNicheRawData } from '@/lib/youtube';
import { fetchTrendsData, TrendsAPIError, TrendsRawData } from '@/lib/trends';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { simplifyQueryWithLLM } from '@/lib/query-simplifier-llm';
import { computeCompetitionScore } from '@/lib/scoring/competition';
import { isRateLimited } from '@/lib/rate-limiter';

const CACHE_TTL_DAYS = 7;

// FIX: how many historical rows to pull for cross-query generalist
// detection and the adaptive authority-pressure calibration. Named as
// a constant since it's now referenced in two places (cache-hit path
// and live-fetch path) and both need to stay in sync.
const HISTORY_LOOKBACK_LIMIT = 50;

function normalizeQuery(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * GET /api/niche?q=<search term>
 *
 * Returns analyzed YouTube + Trends data for a search term, including
 * dynamic opportunity scoring, channel statistics, and insights.
 *
 * Trends and YouTube are fetched independently.
 */
export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
  if (await isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a minute before scanning again.' },
      { status: 429 }
    );
  }

  const query = req.nextUrl.searchParams.get('q');

  if (!query || query.trim().length < 2) {
    return NextResponse.json(
      { error: 'Query param "q" is required (min 2 characters).' },
      { status: 400 }
    );
  }

  const normalizedQuery = normalizeQuery(query);
  const supabase = getSupabaseServerClient();

  // Extract user session from authorization token if present
  let userId: string | null = null;
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        userId = user.id;
      }
    } catch (err) {
      console.warn('Failed to verify token:', err);
    }
  }

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
    // FIX: previously had no .order() before .limit(50), meaning which
    // 50 historical rows came back was whatever Postgres's default scan
    // order happened to be — not necessarily the most recent queries,
    // despite that clearly being the intent (this feeds both cross-query
    // generalist detection AND the adaptive authority-pressure
    // calibration range, both of which are explicitly designed around
    // recent history). Now explicitly ordered by fetched_at descending.
    const { data: history } = await supabase
      .from('niche_lookups')
      .select('youtube_raw')
      .neq('normalized_query', normalizedQuery)
      .order('fetched_at', { ascending: false })
      .limit(HISTORY_LOOKBACK_LIMIT);

    const historicalDatasets = history
      ? history.map((row) => row.youtube_raw as YouTubeNicheRawData).filter(Boolean)
      : [];

    const trendsRaw = cached.trends_raw as TrendsRawData | null;
    const scoreResult = computeCompetitionScore(
      cached.youtube_raw as YouTubeNicheRawData,
      historicalDatasets,
      trendsRaw
    );

    return NextResponse.json({
      source: 'cache',
      fetchedAt: cached.fetched_at,
      simplifiedQuery: trendsRaw ? trendsRaw.query : normalizedQuery,
      scoreResult,
      videos: (cached.youtube_raw as YouTubeNicheRawData).videos || [],
      trends: trendsRaw,
    });
  }

  // 2. No valid cache entry — fetch live from YouTube and Trends in parallel.
  // Use allSettled: a Trends failure shouldn't sink the YouTube data.
  const simplifiedQuery = await simplifyQueryWithLLM(query);
  const [youtubeResult, trendsResult] = await Promise.allSettled([
    fetchYouTubeNicheData(query),
    fetchTrendsData(simplifiedQuery),
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

  // FIX: same missing .order() issue as the cache-hit path above —
  // applied here too for the live-fetch path.
  const { data: history } = await supabase
    .from('niche_lookups')
    .select('youtube_raw')
    .neq('normalized_query', normalizedQuery)
    .order('fetched_at', { ascending: false })
    .limit(HISTORY_LOOKBACK_LIMIT);

  const historicalDatasets = history
    ? history.map((row) => row.youtube_raw as YouTubeNicheRawData).filter(Boolean)
    : [];

  const scoreResult = computeCompetitionScore(
    liveData,
    historicalDatasets,
    trendsData
  );

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
    created_by: userId,
  });

  if (insertError) {
    console.error('Cache write error:', insertError);
  }

  return NextResponse.json({
    source: 'live',
    fetchedAt: liveData.fetchedAt,
    simplifiedQuery,
    scoreResult,
    videos: liveData.videos || [],
    trends: trendsData,
    ...(trendsWarning ? { trendsWarning } : {}),
  });
}