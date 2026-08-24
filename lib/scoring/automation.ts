import { VideoResult } from '../types';
import { SCORING_CONFIG } from './config';

export type AutomationTier = 'HIGH' | 'MEDIUM' | 'LOW';

export interface AutomationResult {
  score: number; // 0-100
  tier: AutomationTier;
  label: string;
  badge: string;
  recommendedTools: string;
  description: string;
}

/**
 * Evaluates whether a niche can be produced faceless (AI voiceover, stock footage, screen recording).
 */
export function evaluateAutomationFeasibility(query: string, videos: VideoResult[] = []): AutomationResult {
  const q = query.toLowerCase();
  const cfg = SCORING_CONFIG.automation;

  const highKeywords = [
    'coding', 'programming', 'python', 'javascript', 'react', 'code', 'tech',
    'finance', 'crypto', 'investing', 'stocks', 'history', 'documentary',
    'audiobook', 'reddit', 'facts', 'motivation', 'news', 'software', 'ai',
    'excel', 'math', 'calculator', 'calculators', 'business', 'trading'
  ];

  const mediumKeywords = [
    'cooking', 'recipe', 'recipes', 'baking', 'meal prep', 'woodworking',
    'diy', 'crafts', 'pottery', 'review', 'reviews', 'unboxing', 'tutorial',
    'tutorials', 'restoration', 'gardening', 'plant', 'car', 'repair'
  ];

  const lowKeywords = [
    'vlog', 'vlogs', 'routine', 'day in the life', 'fitness', 'workout',
    'acting', 'makeup', 'beauty', 'fashion', 'lifestyle', 'travel', 'challenge'
  ];

  let baselineScore = cfg.baselineScore;
  if (highKeywords.some((k) => q.includes(k))) baselineScore = cfg.highScore;
  else if (lowKeywords.some((k) => q.includes(k))) baselineScore = cfg.lowScore;
  else if (mediumKeywords.some((k) => q.includes(k))) baselineScore = cfg.mediumScore;

  if (videos && videos.length > 0) {
    let stockMentions = 0;
    let presentationMentions = 0;
    let personalityMentions = 0;

    const stockRegex = /envato|storyblocks|epidemic|artlist|soundstripe|pexels|pixabay|canva|stock/i;
    const presentationRegex = /slides|powerpoint|screen record|obs|tutorial|guide/i;
    const personalityRegex = /my daily|my vlog|follow me|day in the life|my routine|meet me/i;

    videos.forEach((v) => {
      const textToScan = `${v.title} ${v.description || ''}`.toLowerCase();
      if (stockRegex.test(textToScan)) stockMentions++;
      if (presentationRegex.test(textToScan)) presentationMentions++;
      if (personalityRegex.test(textToScan)) personalityMentions++;
    });

    const stockRatio = stockMentions / videos.length;
    const presentationRatio = presentationMentions / videos.length;
    const personalityRatio = personalityMentions / videos.length;

    if (stockRatio > cfg.stockRatioThreshold || presentationRatio > cfg.presentationRatioThreshold) {
      baselineScore = Math.min(100, baselineScore + cfg.bonusScore);
    }
    if (personalityRatio > cfg.personalityRatioThreshold) {
      baselineScore = Math.max(0, baselineScore - cfg.penaltyScore);
    }
  }

  const score = Math.max(0, Math.min(100, baselineScore));

  let tier: AutomationTier = 'MEDIUM';
  let label = 'Moderate Faceless Potential';
  let badge = `🤖 Moderate Faceless (${score}%)`;
  let recommendedTools = 'Voiceover narration + B-roll footage / slides.';
  let description = 'Can be produced faceless with high-quality narration and engaging visual overlays.';

  if (score >= cfg.highPotentialThreshold) {
    tier = 'HIGH';
    label = 'High Faceless Potential';
    badge = `⚡ High Faceless Potential (${score}%)`;
    recommendedTools = 'Screen recording / slides + AI voiceover (ElevenLabs) + stock footage (Pexels/Envato).';
    description = 'Highly suitable for faceless AI-assisted production. Can be operated completely solo without showing your face.';
  } else if (score < cfg.lowPotentialThreshold) {
    tier = 'LOW';
    label = 'On-Camera Personality Required';
    badge = `👤 On-Camera Personality (${score}%)`;
    recommendedTools = 'On-camera vlogging setup + personal mic.';
    description = 'Personality-driven niche. Audience growth relies heavily on personal charisma, trust, and being on camera.';
  }

  return {
    score,
    tier,
    label,
    badge,
    recommendedTools,
    description,
  };
}
