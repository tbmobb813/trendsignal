import { ChannelMetrics } from './types';
import { SCORING_CONFIG } from './config';

export type EngagementTier = 'HIGH' | 'MEDIUM' | 'LOW';

export interface EngagementResult {
  tier: EngagementTier;
  score: number;
  badge: string;
  label: string;
  monetizationPath: string;
  description: string;
}

/**
 * Evaluates audience loyalty, community passion, and views-to-subscriber ratio of niche specialist channels.
 */
export function evaluateEngagementDensity(query: string, channels: ChannelMetrics[] = []): EngagementResult {
  const q = query.toLowerCase();
  const cfg = SCORING_CONFIG.engagement;

  const highKeywords = [
    'coding', 'programming', 'python', 'javascript', 'woodworking', 'diy',
    'pottery', 'restoration', 'finance', 'investing', 'stocks', 'chess',
    'mechanical', 'electronics', 'gardening', 'audiobook', 'history', 'crafts'
  ];

  const lowKeywords = [
    'news', 'compilation', 'memes', 'funny', 'relaxing', 'lofi',
    'background', 'music', 'asmr', 'rain', 'sleep', 'vlog', 'vlogs'
  ];

  let baselineScore = cfg.baselineScore;
  if (highKeywords.some((k) => q.includes(k))) baselineScore = cfg.highScore;
  else if (lowKeywords.some((k) => q.includes(k))) baselineScore = cfg.lowScore;

  if (channels && channels.length > 0) {
    const specialists = channels.filter((c) => !c.isThin && !c.isGeneralistSuspected);
    const validViewsPerSub = specialists
      .map((c) => c.viewsPerSubscriber)
      .filter((v): v is number => v !== null && v > 0);

    if (validViewsPerSub.length > 0) {
      // Calculate median views per subscriber
      const sorted = [...validViewsPerSub].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const medianViewsPerSub = sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];

      // Standard active channels have views-per-subscriber > 10.
      // If it's > 25, it's a highly loyal fan base. If it's < 5, it is passive lurkers.
      if (medianViewsPerSub >= cfg.highEngagementRatioThreshold) {
        baselineScore = Math.min(100, baselineScore + cfg.bonusScore);
      } else if (medianViewsPerSub < cfg.lowEngagementRatioThreshold) {
        baselineScore = Math.max(10, baselineScore - cfg.penaltyScore);
      }
    }
  }

  const score = Math.max(0, Math.min(100, baselineScore));

  let tier: EngagementTier = 'MEDIUM';
  let badge = '⚖️ Solid Audience Engagement';
  let label = 'Balanced Viewer Interaction';
  let monetizationPath = 'Balanced AdSense + brand sponsorships + product recommendations.';
  let description = 'Steady subscriber interaction and regular comment activity. Good balance of view volume and audience loyalty.';

  if (score >= cfg.highTierThreshold) {
    tier = 'HIGH';
    badge = `🔥 High Community Loyalty (${score}%)`;
    label = 'Passionate Niche Community';
    monetizationPath = 'Patreon / Discord membership, course sales, and high-converting affiliate offers.';
    description = 'Highly passionate audience with strong comment and subscriber retention. Ideal for building a dedicated fan base and selling info-products.';
  } else if (score < cfg.lowTierThreshold) {
    tier = 'LOW';
    badge = `👁️ Passive Lurker Audience (${score}%)`;
    label = 'Casual View Volume';
    monetizationPath = 'AdSense impression volume + broad brand sponsorships.';
    description = 'High casual view counts with lower community retention. Monetization relies almost entirely on high AdSense view volume.';
  }

  return {
    tier,
    score,
    badge,
    label,
    monetizationPath,
    description,
  };
}
