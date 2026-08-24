import { VideoResult } from '../types';
import { SCORING_CONFIG } from './config';

export type BarrierTier = 'LOW' | 'MEDIUM' | 'HIGH';

export interface BarrierEntryResult {
  tier: BarrierTier;
  score: number;
  badge: string;
  label: string;
  setupCost: string;
  description: string;
}

/**
 * Evaluates equipment setup cost and technical skill barrier required to compete in a niche using real video metadata.
 */
export function evaluateBarrierToEntry(query: string, videos: VideoResult[] = []): BarrierEntryResult {
  const q = query.toLowerCase();
  const cfg = SCORING_CONFIG.barrierEntry;

  const lowKeywords = [
    'coding', 'programming', 'python', 'javascript', 'react', 'code', 'excel',
    'math', 'software', 'ai', 'gaming', 'minecraft', 'audiobook', 'reddit',
    'calculator', 'calculators', 'facts'
  ];

  const highKeywords = [
    'aviation', 'pilot', 'car overhaul', 'engine rebuild', 'scuba', 'medical',
    'surgery', 'commercial real estate', 'machining', 'cnc', 'blacksmithing',
    'extreme sports', 'race car'
  ];

  let baselineScore = cfg.baselineScore;
  if (highKeywords.some((k) => q.includes(k))) baselineScore = cfg.highScore;
  else if (lowKeywords.some((k) => q.includes(k))) baselineScore = cfg.lowScore;

  if (videos && videos.length > 0) {
    let heavyGearMentions = 0;
    let basicSetupMentions = 0;

    const gearRegex = /camera|lens|tripod|microphone|kiln|lathe|welder|workshop|studio gear|audio interface/i;
    const basicRegex = /obs|screen recording|free download|slides|notion template/i;

    videos.forEach((v) => {
      const textToScan = `${v.title} ${v.description || ''}`.toLowerCase();
      if (gearRegex.test(textToScan)) heavyGearMentions++;
      if (basicRegex.test(textToScan)) basicSetupMentions++;
    });

    const gearRatio = heavyGearMentions / videos.length;
    const basicRatio = basicSetupMentions / videos.length;

    if (gearRatio > cfg.gearRatioThreshold) {
      baselineScore = Math.min(100, baselineScore + cfg.gearBonus);
    }
    if (basicRatio > cfg.basicRatioThreshold) {
      baselineScore = Math.max(0, baselineScore - cfg.basicReduction);
    }
  }

  const score = Math.max(0, Math.min(100, baselineScore));

  let tier: BarrierTier = 'MEDIUM';
  let badge = '🟡 Medium Entry Barrier ($300–$800)';
  let label = 'Moderate Setup Required';
  let setupCost = 'Intermediate camera rig + overhead mount + basic lighting & workshop/kitchen tools.';
  let description = 'Requires a dedicated physical workspace or specialized tools, but remains accessible for committed creators.';

  if (score >= cfg.highBarrierThreshold) {
    tier = 'HIGH';
    badge = `🔴 High Entry Barrier (${score}%)`;
    label = 'High Competitive Moat';
    setupCost = 'Cinema camera gear + specialized workshop assets / licensed domain expertise.';
    description = 'Significant financial or certification barrier. Limits new entrants, protecting established channels from quick copycats.';
  } else if (score < cfg.lowBarrierThreshold) {
    tier = 'LOW';
    badge = `🟢 Low Entry Barrier (${score}%)`;
    label = 'Fast Launch Readiness';
    setupCost = 'PC / Smartphone + free OBS screen recorder + $30 USB mic.';
    description = 'Minimal financial or equipment barrier. You can start producing competitive videos immediately with basic gear.';
  }

  return {
    tier,
    score,
    badge,
    label,
    setupCost,
    description,
  };
}
