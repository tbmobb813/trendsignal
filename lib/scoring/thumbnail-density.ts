export type ThumbnailDensityType = 'RED_OCEAN' | 'AESTHETIC_OPPORTUNITY' | 'BALANCED';

export interface ThumbnailDensityResult {
  type: ThumbnailDensityType;
  score: number;
  badge: string;
  label: string;
  description: string;
}

/**
 * Rates thumbnail visual saturation and graphic design complexity barriers.
 */
export function evaluateThumbnailDensity(query: string): ThumbnailDensityResult {
  const q = query.toLowerCase();

  const redOceanKeywords = [
    'gaming', 'minecraft', 'challenge', 'unboxing', 'reviews', 'stocks',
    'trading', 'crypto', 'investing', 'memes', 'reaction'
  ];

  const aestheticKeywords = [
    'coding', 'programming', 'python', 'javascript', 'excel', 'math',
    'woodworking', 'diy', 'pottery', 'crafts', 'gardening', 'cooking',
    'recipe', 'recipes', 'baking', 'lofi', 'asmr', 'routine', 'vlog'
  ];

  if (redOceanKeywords.some((k) => q.includes(k))) {
    return {
      type: 'RED_OCEAN',
      score: 30,
      badge: '🔴 Visual Red Ocean (Saturated)',
      label: 'Hyper-Designed Clickbait SERP',
      description: 'Dominated by high-contrast faces, glowing text outlines, and red arrows. High graphic design effort or hiring budget is required to compete for click-through rate.',
    };
  }

  if (aestheticKeywords.some((k) => q.includes(k))) {
    return {
      type: 'AESTHETIC_OPPORTUNITY',
      score: 90,
      badge: '🟢 Aesthetic Opportunity (Clean)',
      label: 'Minimalist / Screenshot Friendly',
      description: 'SERP favors clean code screenshots, minimalist text, or authentic raw photos. High opportunity to win clicks using clean, premium, minimalist layouts.',
    };
  }

  return {
    type: 'BALANCED',
    score: 60,
    badge: '🟡 Balanced Design (Standard)',
    label: 'Standard Click-Through Layouts',
    description: 'Mix of clean authentic layouts and standard high-contrast elements. Requires typical visual design structure to stand out.',
  };
}
