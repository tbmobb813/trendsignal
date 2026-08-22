/**
 * Google Trends client via the unofficial `google-trends-api` package.
 * Same philosophy as lib/youtube.ts: this file returns raw data only,
 * no scoring or interpretation.
 *
 * IMPORTANT CAVEAT: this is an unofficial, reverse-engineered client
 * hitting Google's internal endpoints — not a supported public API.
 * It can break without warning if Google changes their internal
 * format. Wrap every call site in error handling that degrades
 * gracefully (treat a Trends failure as "unknown demand," not as a
 * reason to fail the whole niche lookup) rather than assuming it will
 * always succeed the way the YouTube Data API call does.
 */
import googleTrends from 'google-trends-api';

export interface TrendsDataPoint {
  time: string; // unix timestamp as string
  formattedTime: string; // e.g. "Jun 2026"
  value: number; // 0-100 relative interest scale
  hasData: boolean; // false = Google has no meaningful signal for this point
}

export interface TrendsRawData {
  query: string;
  fetchedAt: string;
  points: TrendsDataPoint[];
  /**
   * Fraction of points where hasData is true, over the trailing 24 months.
   * This is the cheapest possible "is there any demand signal at all"
   * check — see lib/scoring for how it's used to gate the opportunity
   * score. A value near 0 means Google Trends essentially has nothing
   * on this term (see "restoring vintage mechanical calculators" in
   * test-data/ for a real example).
   */
  recentDataCoverage: number;
}

class TrendsAPIError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'TrendsAPIError';
  }
}

/**
 * Fetch relative search interest over time for a query. Returns the
 * full available history (typically ~20 years of monthly points) —
 * callers needing just recent data should slice points by date.
 */
export async function fetchTrendsData(query: string): Promise<TrendsRawData> {
  let raw: string;
  try {
    raw = await googleTrends.interestOverTime({ keyword: query });
  } catch (err) {
    throw new TrendsAPIError(`Google Trends request failed for "${query}"`, err);
  }

  interface TrendsTimelinePoint {
    time: string;
    formattedTime: string;
    value: number[];
    hasData: boolean[];
  }

  let parsed: { default?: { timelineData?: TrendsTimelinePoint[] } } | null = null;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new TrendsAPIError(`Google Trends returned unparseable data for "${query}"`, err);
  }

  const timelineData = parsed?.default?.timelineData;
  if (!Array.isArray(timelineData)) {
    throw new TrendsAPIError(`Google Trends response missing timelineData for "${query}"`);
  }

  const points: TrendsDataPoint[] = timelineData.map((p) => ({
    time: p.time,
    formattedTime: p.formattedTime,
    value: Array.isArray(p.value) ? p.value[0] ?? 0 : 0,
    hasData: Array.isArray(p.hasData) ? p.hasData[0] ?? false : false,
  }));

  // Trailing 24 months — recent coverage matters more than 20-year history
  // for "is this niche alive right now"
  const recentPoints = points.slice(-24);
  const recentDataCoverage =
    recentPoints.length > 0
      ? recentPoints.filter((p) => p.hasData).length / recentPoints.length
      : 0;

  return {
    query,
    fetchedAt: new Date().toISOString(),
    points,
    recentDataCoverage,
  };
}

export { TrendsAPIError };
