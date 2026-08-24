import { VideoResult } from '../types';
import { SCORING_CONFIG } from './config';

export type SafetyStatus = 'SAFE' | 'CAUTION' | 'RESTRICTED';

export interface AdvertiserSafetyResult {
  status: SafetyStatus;
  score: number;
  badge: string;
  label: string;
  warningNotes: string[];
  description: string;
}

/**
 * Evaluates search term compliance with YouTube YPP Advertiser-Friendly Guidelines using real video metadata.
 */
export function evaluateAdvertiserSafety(query: string, videos: VideoResult[] = []): AdvertiserSafetyResult {
  const q = query.toLowerCase();
  const cfg = SCORING_CONFIG.advertiserSafety;

  const restrictedKeywords = [
    'gambling', 'casino', 'betting', 'poker', 'slots', 'weapon', 'weapons',
    'guns', 'piracy', 'torrent', 'hacks', 'cheats', 'adult', 'nsfw', 'drugs',
    'weed', 'violence', 'dark web'
  ];

  const cautionKeywords = [
    'crypto', 'trading', 'forex', 'get rich', 'medical', 'cure', 'weight loss',
    'political', 'politics', 'crime', 'conspiracy', 'scam', 'lawsuit', 'investing'
  ];

  let baselineScore = cfg.baselineScore;
  if (restrictedKeywords.some((k) => q.includes(k))) baselineScore = cfg.restrictedScore;
  else if (cautionKeywords.some((k) => q.includes(k))) baselineScore = cfg.cautionScore;

  let warningNotes: string[] = [];

  if (videos && videos.length > 0) {
    let restrictedHits = 0;
    let cautionHits = 0;

    const restrictedRegex = /gambling|casino|betting|poker|slots|weapon|gun|piracy|torrent|hack|cheat|adult|nsfw|drugs|weed|violence|murder|dark web/i;
    const cautionRegex = /crypto|trading|forex|get rich|medical|cure|weight loss|political|politics|crime|conspiracy|scam|lawsuit|investing/i;

    videos.forEach((v) => {
      const textToScan = `${v.title} ${v.description || ''}`.toLowerCase();
      if (restrictedRegex.test(textToScan)) restrictedHits++;
      if (cautionRegex.test(textToScan)) cautionHits++;
    });

    const restrictedRatio = restrictedHits / videos.length;
    const cautionRatio = cautionHits / videos.length;

    if (restrictedRatio > cfg.restrictedRatioThreshold) {
      baselineScore = Math.min(baselineScore, cfg.restrictedScore);
    } else if (cautionRatio > cfg.cautionRatioThreshold) {
      baselineScore = Math.min(baselineScore, cfg.cautionScore);
    }
  }

  const score = Math.max(0, Math.min(100, baselineScore));

  let status: SafetyStatus = 'SAFE';
  let badge = '🟢 100% Advertiser Friendly';
  let label = 'Premium Ad Eligible';
  let description = 'Clean, brand-safe content. Premium advertisers bid aggressively for placements in this vertical.';

  if (score <= 40) {
    status = 'RESTRICTED';
    badge = '🔴 High Demonetization Risk';
    label = 'Advertiser Restricted';
    warningNotes = [
      'Query and/or ranking videos contain terms restricted under YouTube YPP Advertiser-Friendly Guidelines.',
      'High risk of yellow dollar sign (demonetization) or limited ad inventory.',
    ];
    description = 'Restricted topic for advertisers. Monetization through AdSense will be severely limited; sponsorship reliance is mandatory.';
  } else if (score < 80) {
    status = 'CAUTION';
    badge = '🟡 Moderate Safety Caution';
    label = 'Financial / Health Disclaimers Required';
    warningNotes = [
      'Niche involves sensitive topics (financial or medical claims).',
      'Must include explicit on-screen disclaimers to prevent automated ad suppression.',
    ];
    description = 'Moderate advertiser caution. Requires clear disclaimers to maintain full AdSense eligibility.';
  } else {
    warningNotes = [
      'Fully compliant with YouTube YPP Advertiser-Friendly Guidelines.',
      'Eligible for premium ad placements and maximum CPM rates.',
    ];
  }

  return {
    status,
    score,
    badge,
    label,
    warningNotes,
    description,
  };
}
