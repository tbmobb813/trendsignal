import { SCORING_CONFIG } from './config';

export interface VideoItemForFreshness {
  publishedAt: string;
}

export type FreshnessType = 'EVERGREEN' | 'HIGH_VELOCITY' | 'BALANCED';

export interface FreshnessResult {
  type: FreshnessType;
  avgAgeDays: number;
  badge: string;
  label: string;
  description: string;
}

/**
 * Analyzes search result video upload ages to evaluate content longevity vs. upload frequency velocity.
 */
export function analyzeSerpFreshness(videos: VideoItemForFreshness[]): FreshnessResult {
  const cfg = SCORING_CONFIG.freshness;

  if (!videos || videos.length === 0) {
    return {
      type: 'EVERGREEN',
      avgAgeDays: cfg.fallbackEvergreenDays,
      badge: '🌲 Evergreen Longevity (1.4 yrs avg)',
      label: 'High Evergreen Longevity',
      description: 'Top search results retain ranking power over long periods. High passive view longevity.',
    };
  }

  const now = Date.now();
  const validAges = videos
    .map((v) => {
      const pubTime = new Date(v.publishedAt).getTime();
      if (isNaN(pubTime)) return null;
      const diffMs = now - pubTime;
      return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    })
    .filter((age): age is number => age !== null);

  if (validAges.length === 0) {
    return {
      type: 'BALANCED',
      avgAgeDays: cfg.fallbackBalancedDays,
      badge: '⚖️ Balanced Longevity (8mo avg)',
      label: 'Balanced Longevity',
      description: 'Healthy mix of recent uploads and established videos.',
    };
  }

  const avgAgeDays = Math.round(validAges.reduce((sum, a) => sum + a, 0) / validAges.length);

  if (avgAgeDays >= cfg.evergreenThreshold) {
    const avgYears = (avgAgeDays / 365).toFixed(1);
    return {
      type: 'EVERGREEN',
      avgAgeDays,
      badge: `🌲 Evergreen Longevity (${avgYears} yrs avg)`,
      label: 'High Evergreen Longevity',
      description: 'Top search results have held rankings for 1.5+ years. High passive view longevity without requiring constant re-uploads.',
    };
  }

  if (avgAgeDays <= cfg.velocityThreshold) {
    return {
      type: 'HIGH_VELOCITY',
      avgAgeDays,
      badge: `⚡ High Velocity Required (${avgAgeDays}d avg)`,
      label: 'High Freshness Velocity',
      description: 'Search algorithm heavily favors newly published videos (<4 months old). Niche requires a continuous, high-frequency upload schedule.',
    };
  }

  const avgMonths = Math.round(avgAgeDays / 30);
  return {
    type: 'BALANCED',
    avgAgeDays,
    badge: `⚖️ Balanced Longevity (${avgMonths}mo avg)`,
    label: 'Balanced Longevity',
    description: 'Healthy mix of recent uploads and established videos. Good balance between search ranking stability and current relevance.',
  };
}
