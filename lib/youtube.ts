/**
 * YouTube Data API v3 client.
 *
 * Deliberately does ZERO scoring or interpretation here — this file's
 * only job is: given a search term, return real data about the top
 * results and their channels. Scoring lives in a separate module that
 * operates on this output, so it stays testable without hitting the
 * network.
 *
 * Quota cost (important — this determines how aggressively you can
 * dev/test before hitting the wall):
 *   search.list   = 100 units per call
 *   channels.list = 1 unit per call (regardless of how many IDs you batch)
 *   Free tier     = 10,000 units/day
 *   => roughly 100 searches/day before you're rate-limited, since the
 *      search call dominates cost and the channel batch call is cheap.
 */

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

export interface YouTubeVideoResult {
  videoId: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
}

export interface YouTubeChannelStats {
  channelId: string;
  title: string;
  subscriberCount: number | null; // null if the channel hides sub count
  viewCount: number;
  videoCount: number;
  publishedAt: string; // channel creation date — useful for "new channel" outlier detection
}

export interface YouTubeNicheRawData {
  query: string;
  fetchedAt: string;
  videos: YouTubeVideoResult[];
  channels: YouTubeChannelStats[];
}

class YouTubeAPIError extends Error {
  constructor(message: string, public status?: number, public body?: unknown) {
    super(message);
    this.name = 'YouTubeAPIError';
  }
}

function getApiKey(): string {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    throw new Error(
      'YOUTUBE_API_KEY is not set. Add it to .env.local (server-side only — never expose this to the client).'
    );
  }
  return key;
}

/**
 * Step 1: search for videos matching a query, return the top N results.
 * Costs 100 quota units regardless of maxResults.
 */
async function searchVideos(
  query: string,
  maxResults = 25
): Promise<YouTubeVideoResult[]> {
  const apiKey = getApiKey();
  const url = new URL(`${YOUTUBE_API_BASE}/search`);
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('q', query);
  url.searchParams.set('type', 'video');
  url.searchParams.set('maxResults', String(maxResults));
  url.searchParams.set('order', 'relevance'); // matches what a real viewer would see
  url.searchParams.set('key', apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new YouTubeAPIError(
      `YouTube search.list failed: ${res.status}`,
      res.status,
      body
    );
  }

  const data = await res.json();

  interface YouTubeSearchItem {
    id: { videoId: string };
    snippet: {
      title: string;
      description: string;
      channelId: string;
      channelTitle: string;
      publishedAt: string;
    };
  }

  return (data.items ?? []).map((item: YouTubeSearchItem) => ({
    videoId: item.id.videoId,
    title: item.snippet.title,
    description: item.snippet.description || '',
    channelId: item.snippet.channelId,
    channelTitle: item.snippet.channelTitle,
    publishedAt: item.snippet.publishedAt,
  }));
}

/**
 * Step 2: given a list of channel IDs, pull subscriber/view/video counts.
 * Batches up to 50 IDs per call (API max) — costs 1 unit per call, not per ID.
 */
async function getChannelStats(
  channelIds: string[]
): Promise<YouTubeChannelStats[]> {
  if (channelIds.length === 0) return [];

  const apiKey = getApiKey();
  const results: YouTubeChannelStats[] = [];

  // Batch into groups of 50 (API limit per request)
  for (let i = 0; i < channelIds.length; i += 50) {
    const batch = channelIds.slice(i, i + 50);
    const url = new URL(`${YOUTUBE_API_BASE}/channels`);
    url.searchParams.set('part', 'snippet,statistics');
    url.searchParams.set('id', batch.join(','));
    url.searchParams.set('key', apiKey);

    const res = await fetch(url.toString());
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new YouTubeAPIError(
        `YouTube channels.list failed: ${res.status}`,
        res.status,
        body
      );
    }

    const data = await res.json();

    for (const item of data.items ?? []) {
      results.push({
        channelId: item.id,
        title: item.snippet.title,
        // hiddenSubscriberCount is real — some channels hide this,
        // and treating it as 0 would corrupt any ratio built on it
        subscriberCount: item.statistics.hiddenSubscriberCount
          ? null
          : Number(item.statistics.subscriberCount ?? 0),
        viewCount: Number(item.statistics.viewCount ?? 0),
        videoCount: Number(item.statistics.videoCount ?? 0),
        publishedAt: item.snippet.publishedAt,
      });
    }
  }

  return results;
}

/**
 * Main entry point: given a search term, return the top video results
 * plus stats for every unique channel among them.
 *
 * This is intentionally the ONLY exported function most callers need.
 * Raw output — no scoring, no derived ratios. That happens downstream.
 */
export async function fetchYouTubeNicheData(
  query: string,
  maxResults = 25
): Promise<YouTubeNicheRawData> {
  const videos = await searchVideos(query, maxResults);

  const uniqueChannelIds = Array.from(
    new Set(videos.map((v) => v.channelId))
  );

  const channels = await getChannelStats(uniqueChannelIds);

  return {
    query,
    fetchedAt: new Date().toISOString(),
    videos,
    channels,
  };
}

export { YouTubeAPIError };