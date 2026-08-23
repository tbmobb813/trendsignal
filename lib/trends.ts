/**
 * Google Trends client via the unofficial `google-trends-api` package.
 * Same philosophy as lib/youtube.ts: this file returns raw data only,
 * no scoring or interpretation.
 */
import googleTrends from 'google-trends-api';

export interface TrendsDataPoint {
  time: string; // unix timestamp as string
  formattedTime: string; // e.g. "Jun 2026"
  value: number; // 0-100 relative interest scale
  hasData: boolean; // false = Google has no meaningful signal for this point
}

export interface RelatedQueryItem {
  query: string;
  value: number | string; // numeric for Top, string (e.g. "+250%" or "Breakout") for Rising
  type: 'top' | 'rising';
}

export interface TrendsRawData {
  query: string;
  fetchedAt: string;
  points: TrendsDataPoint[];
  recentDataCoverage: number;
  relatedTop: RelatedQueryItem[];
  relatedRising: RelatedQueryItem[];
}

class TrendsAPIError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'TrendsAPIError';
  }
}

/**
 * Extracts the primary single-word noun root for Google Trends relatedQueries fallback.
 */
function getPrimaryNounRoot(q: string): string {
  const stopWords = new Set([
    'for', 'in', 'how', 'to', 'best', 'the', 'a', 'an', 'of', 'and',
    '2024', '2025', '2026', 'beginners', 'basics', 'tutorial', 'guide',
    'easy', 'ideas', 'tips', 'apps', 'top', 'with', 'from', 'on'
  ]);

  const words = q
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  if (words.length === 0) return q;
  // Return the longest core word (typically the primary topic noun e.g. 'pottery', 'sharpening')
  const sorted = [...words].sort((a, b) => b.length - a.length);
  return sorted[0];
}

/**
 * Safely parses googleTrends.relatedQueries JSON string output.
 */
function parseRelatedQueriesResponse(raw: string): { top: RelatedQueryItem[]; rising: RelatedQueryItem[] } {
  const top: RelatedQueryItem[] = [];
  const rising: RelatedQueryItem[] = [];

  try {
    const parsed = JSON.parse(raw);
    const rankedLists = parsed?.default?.rankedList || [];

    // Top queries list (index 0)
    if (Array.isArray(rankedLists[0]?.rankedKeyword)) {
      rankedLists[0].rankedKeyword.slice(0, 8).forEach((item: { query?: string; value?: number | string }) => {
        if (item.query && item.query.trim()) {
          top.push({
            query: item.query.trim(),
            value: item.value ?? 0,
            type: 'top',
          });
        }
      });
    }

    // Rising queries list (index 1)
    if (Array.isArray(rankedLists[1]?.rankedKeyword)) {
      rankedLists[1].rankedKeyword.slice(0, 8).forEach((item: { query?: string; formattedValue?: string; value?: number | string }) => {
        if (item.query && item.query.trim()) {
          rising.push({
            query: item.query.trim(),
            value: item.formattedValue || item.value || 'Breakout',
            type: 'rising',
          });
        }
      });
    }
  } catch {
    // Ignore JSON parse errors
  }

  return { top, rising };
}

/**
 * Fetch relative search interest over time & related sub-queries for a term.
 */
export async function fetchTrendsData(query: string): Promise<TrendsRawData> {
  const [timelineRes, relatedRes] = await Promise.allSettled([
    googleTrends.interestOverTime({ keyword: query }),
    googleTrends.relatedQueries({ keyword: query }),
  ]);

  if (timelineRes.status === 'rejected') {
    throw new TrendsAPIError(`Google Trends timeline request failed for "${query}"`, timelineRes.reason);
  }

  const rawTimeline = timelineRes.value;

  interface TrendsTimelinePoint {
    time: string;
    formattedTime: string;
    value: number[];
    hasData: boolean[];
  }

  let parsedTimeline: { default?: { timelineData?: TrendsTimelinePoint[] } } | null = null;
  try {
    parsedTimeline = JSON.parse(rawTimeline);
  } catch (err) {
    throw new TrendsAPIError(`Google Trends returned unparseable timeline data for "${query}"`, err);
  }

  const timelineData = parsedTimeline?.default?.timelineData;
  if (!Array.isArray(timelineData)) {
    throw new TrendsAPIError(`Google Trends response missing timelineData for "${query}"`);
  }

  const points: TrendsDataPoint[] = timelineData.map((p) => ({
    time: p.time,
    formattedTime: p.formattedTime,
    value: Array.isArray(p.value) ? p.value[0] ?? 0 : 0,
    hasData: Array.isArray(p.hasData) ? p.hasData[0] ?? false : false,
  }));

  // Trailing 24 months
  const recentPoints = points.slice(-24);
  const recentDataCoverage =
    recentPoints.length > 0
      ? recentPoints.filter((p) => p.hasData).length / recentPoints.length
      : 0;

  // Safely parse initial related queries
  let relatedTop: RelatedQueryItem[] = [];
  let relatedRising: RelatedQueryItem[] = [];

  if (relatedRes.status === 'fulfilled' && relatedRes.value) {
    const { top, rising } = parseRelatedQueriesResponse(relatedRes.value);
    relatedTop = top;
    relatedRising = rising;
  }

  // Primary Noun Fallback: If long-tail query returned 0 related terms, try primary noun root
  if (relatedTop.length === 0 && relatedRising.length === 0) {
    const primaryNoun = getPrimaryNounRoot(query);
    if (primaryNoun && primaryNoun.toLowerCase() !== query.toLowerCase()) {
      try {
        const fallbackRaw = await googleTrends.relatedQueries({ keyword: primaryNoun });
        const { top, rising } = parseRelatedQueriesResponse(fallbackRaw);
        relatedTop = top;
        relatedRising = rising;
      } catch {
        // Fallback failure is non-fatal
      }
    }
  }

  return {
    query,
    fetchedAt: new Date().toISOString(),
    points,
    recentDataCoverage,
    relatedTop,
    relatedRising,
  };
}

export { TrendsAPIError };
