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

export type LifecycleStageType = 'EARLY_RISING' | 'PEAK_HYPE' | 'MATURE_PLATEAU' | 'DECLINING';

export interface TrendLifecycleInfo {
  stage: LifecycleStageType;
  label: string;
  badge: string;
  color: 'emerald' | 'amber' | 'blue' | 'rose';
  description: string;
}

export interface TrendsRawData {
  query: string;
  fetchedAt: string;
  points: TrendsDataPoint[];
  recentDataCoverage: number;
  relatedTop: RelatedQueryItem[];
  relatedRising: RelatedQueryItem[];
  lifecycle: TrendLifecycleInfo;
}

class TrendsAPIError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'TrendsAPIError';
  }
}

/**
 * Calculates Trend Lifecycle Stage from time-series points slope.
 */
export function calculateTrendLifecycle(points: TrendsDataPoint[]): TrendLifecycleInfo {
  if (points.length < 6) {
    return {
      stage: 'MATURE_PLATEAU',
      label: 'Mature Plateau',
      badge: '⚖️ Stable Evergreen Demand',
      color: 'blue',
      description: 'Consistent, stable search volume. A reliable evergreen category with predictable interest.',
    };
  }

  const recent6 = points.slice(-6);
  const firstHalf = recent6.slice(0, 3);
  const secondHalf = recent6.slice(3);

  const firstHalfAvg = firstHalf.reduce((sum, p) => sum + p.value, 0) / firstHalf.length;
  const secondHalfAvg = secondHalf.reduce((sum, p) => sum + p.value, 0) / secondHalf.length;

  let growthRate = 0;
  if (firstHalfAvg === 0) {
    growthRate = secondHalfAvg > 0 ? 1 : 0;
  } else {
    growthRate = (secondHalfAvg - firstHalfAvg) / firstHalfAvg;
  }

  const latestValue = points[points.length - 1]?.value ?? 0;

  if (growthRate >= 0.25) {
    return {
      stage: 'EARLY_RISING',
      label: 'Early Rising Trend',
      badge: `🚀 Early Rising (+${Math.round(growthRate * 100)}% 6mo)`,
      color: 'emerald',
      description: 'Accelerating search interest over trailing 6 months. Strong early-mover advantage for new channels.',
    };
  }

  if (latestValue >= 75 && growthRate >= -0.1) {
    return {
      stage: 'PEAK_HYPE',
      label: 'Peak Hype Interest',
      badge: `🔥 Peak Hype (${latestValue}/100)`,
      color: 'amber',
      description: 'Search interest is near historical peak. Demand is high, but competition for top rankings is intense.',
    };
  }

  if (growthRate <= -0.2) {
    return {
      stage: 'DECLINING',
      label: 'Declining Search Demand',
      badge: `📉 Declining (${Math.round(growthRate * 100)}% 6mo)`,
      color: 'rose',
      description: 'Search volume is trending downward over the trailing 6 months. High risk of diminishing long-term returns.',
    };
  }

  return {
    stage: 'MATURE_PLATEAU',
    label: 'Mature Plateau',
    badge: '⚖️ Stable Evergreen Demand',
    color: 'blue',
    description: 'Consistent, stable search volume. A reliable evergreen category with predictable audience interest.',
  };
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

  const lifecycle = calculateTrendLifecycle(points);

  return {
    query,
    fetchedAt: new Date().toISOString(),
    points,
    recentDataCoverage,
    relatedTop,
    relatedRising,
    lifecycle,
  };
}

export { TrendsAPIError };
