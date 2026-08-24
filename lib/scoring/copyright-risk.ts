import { VideoResult } from '../types';
import { SCORING_CONFIG } from './config';

export type CopyrightRiskStatus = 'SAFE' | 'CAUTION' | 'HIGH_RISK';

export interface CopyrightRiskResult {
  status: CopyrightRiskStatus;
  score: number;
  badge: string;
  label: string;
  description: string;
}

/**
 * Evaluates search term intellectual property risks and Content ID claim sensitivity using real video metadata.
 */
export function evaluateCopyrightRisk(query: string, videos: VideoResult[] = []): CopyrightRiskResult {
  const q = query.toLowerCase();
  const cfg = SCORING_CONFIG.copyrightRisk;

  const highRiskKeywords = [
    'movie', 'movies', 'film', 'films', 'anime', 'tv show', 'tv shows',
    'netflix', 'episode', 'episodes', 'reaction', 'reacts', 'reacting',
    'song', 'songs', 'music', 'lyrics', 'cover', 'covers', 'sports',
    'nfl', 'nba', 'highlights', 'football', 'basketball'
  ];

  const cautionKeywords = [
    'gaming', 'gameplay', 'let\'s play', 'nintendo', 'playstation', 'xbox',
    'crime', 'documentary', 'history', 'news'
  ];

  let baselineScore = cfg.baselineScore;
  if (highRiskKeywords.some((k) => q.includes(k))) baselineScore = cfg.highRiskScore;
  else if (cautionKeywords.some((k) => q.includes(k))) baselineScore = cfg.cautionScore;

  if (videos && videos.length > 0) {
    let mediaHits = 0;
    let fairUseMentions = 0;
    let gamingHits = 0;

    const mediaRegex = /movie|clip|episode|netflix|soundtrack|song|lyrics|nba|nfl|ufc|highlights/i;
    const fairUseRegex = /fair use|section 107|copyright disclaimer|no copyright intended/i;
    const gamingRegex = /gameplay|walkthrough|lets play|nintendo|playstation|xbox|steam/i;

    videos.forEach((v) => {
      const textToScan = `${v.title} ${v.description || ''}`.toLowerCase();
      if (mediaRegex.test(textToScan)) mediaHits++;
      if (fairUseRegex.test(textToScan)) fairUseMentions++;
      if (gamingRegex.test(textToScan)) gamingHits++;
    });

    const mediaRatio = mediaHits / videos.length;
    const fairUseRatio = fairUseMentions / videos.length;
    const gamingRatio = gamingHits / videos.length;

    if (mediaRatio > cfg.mediaRatioThreshold) {
      baselineScore = Math.min(baselineScore, cfg.highRiskScore); // Push directly into high risk
    } else if (gamingRatio > cfg.gamingRatioThreshold) {
      baselineScore = Math.min(baselineScore, cfg.gamingCautionScore); // Gaming gameplay triggers caution
    }

    // Fair use disclaimers confirm it is caution/high risk context
    if (fairUseRatio > cfg.fairUseRatioThreshold) {
      baselineScore = Math.min(baselineScore, cfg.fairUseCautionScore);
    }
  }

  const score = Math.max(0, Math.min(100, baselineScore));

  let status: CopyrightRiskStatus = 'SAFE';
  let label = 'Original Content Safe';
  let badge = '🟢 100% Original Footage';
  let description = 'Consists of entirely self-recorded footage and royalty-free audio tracks. Safe from Content ID claims and strikes.';

  if (score <= 40) {
    status = 'HIGH_RISK';
    label = 'Content ID Claim Prone';
    badge = '🔴 High Copyright Risk';
    description = 'Uses third-party media clips or music. Prone to automated Content ID revenue redirections or manual copyright strikes.';
  } else if (score < 80) {
    status = 'CAUTION';
    label = 'Fair Use Vigilance Required';
    badge = '🟡 Moderate Claim Caution';
    description = 'Uses video game assets or historical public archives. Generally safe, but requires careful editing to avoid trigger flags.';
  }

  return {
    status,
    score,
    badge,
    label,
    description,
  };
}
