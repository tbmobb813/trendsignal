import { VideoResult } from '../types';
import { SCORING_CONFIG } from './config';

export interface RevenueDiversityResult {
  score: number;
  badge: string;
  label: string;
  digitalScore: number;
  physicalScore: number;
  sponsorScore: number;
  description: string;
}

/**
 * Rates the feasibility of non-AdSense revenue channels (Digital products, Physical affiliates, and sponsorships) using real video metadata.
 */
export function calculateRevenueDiversity(query: string, videos: VideoResult[] = []): RevenueDiversityResult {
  const q = query.toLowerCase();
  const cfg = SCORING_CONFIG.revenueDiversity;

  // Baseline fallbacks based on keywords
  const highDigital = ['coding', 'programming', 'python', 'javascript', 'react', 'code', 'excel', 'finance', 'investing', 'trading', 'math', 'calculator', 'software', 'ai', 'templates'];
  const highPhysical = ['cooking', 'recipe', 'recipes', 'baking', 'woodworking', 'diy', 'crafts', 'pottery', 'restoration', 'review', 'reviews', 'unboxing', 'camera', 'gear', 'makeup', 'beauty', 'fashion', 'gardening', 'laptop', 'keyboard', 'monitor'];
  const highSponsor = ['tech', 'productivity', 'routine', 'lifestyle', 'cooking', 'fitness', 'vlog', 'finance', 'investing', 'business', 'coding', 'programming', 'software', 'code'];
  const lowSponsor = ['memes', 'compilation', 'funny', 'political', 'politics', 'crime', 'piracy', 'torrent', 'hacks', 'cheats'];

  let defaultDigital = cfg.defaultDigital;
  let defaultPhysical = cfg.defaultPhysical;
  let defaultSponsor = cfg.defaultSponsor;

  if (highDigital.some((k) => q.includes(k))) defaultDigital = cfg.highDigital;
  if (highPhysical.some((k) => q.includes(k))) defaultPhysical = cfg.highPhysical;
  if (highSponsor.some((k) => q.includes(k))) defaultSponsor = cfg.highSponsor;
  if (lowSponsor.some((k) => q.includes(k))) defaultSponsor = cfg.lowSponsor;

  let digitalScore = defaultDigital;
  let physicalScore = defaultPhysical;
  let sponsorScore = defaultSponsor;

  if (videos && videos.length > 0) {
    let digitalHits = 0;
    let physicalHits = 0;
    let sponsorHits = 0;

    const digitalRegex = /gumroad|teachable|course|download|ebook|pdf|template|patreon|buymeacoffee|ko-fi/i;
    const physicalRegex = /amzn\.to|amazon\.com|affiliate|genius\.link|kit\.co|gear|shop|my setup|store/i;
    const sponsorRegex = /sponsor|business|partnership|collab|inquiry|contact|email/i;

    videos.forEach((v) => {
      const textToScan = `${v.title} ${v.description || ''}`.toLowerCase();
      if (digitalRegex.test(textToScan)) digitalHits++;
      if (physicalRegex.test(textToScan)) physicalHits++;
      if (sponsorRegex.test(textToScan)) sponsorHits++;
    });

    const total = videos.length;
    digitalScore = Math.round(Math.min(100, (digitalScore + (digitalHits / total) * 100) / 2));
    physicalScore = Math.round(Math.min(100, (physicalScore + (physicalHits / total) * 100) / 2));
    sponsorScore = Math.round(Math.min(100, (sponsorScore + (sponsorHits / total) * 100) / 2));
  }

  const score = Math.round((digitalScore + physicalScore + sponsorScore) / 3);

  let label = 'Moderate Revenue Diversity';
  let badge = '⚖️ Moderate Diversity';
  let description = 'Steady AdSense potential, with moderate opportunities for sponsorships and affiliate links.';

  if (score >= cfg.highTierThreshold) {
    label = 'Excellent Revenue Diversity';
    badge = '💰 High Revenue Diversity';
    description = 'Outstanding potential to monetize beyond AdSense. Strong alignment with sponsorships, physical affiliates, or digital downloads.';
  } else if (score < cfg.lowTierThreshold) {
    label = 'Low Revenue Diversity';
    badge = '⚠️ Low Revenue Diversity';
    description = 'Monetization relies heavily on AdSense views. Limited direct product or sponsor integration opportunities.';
  }

  return {
    score,
    badge,
    label,
    digitalScore,
    physicalScore,
    sponsorScore,
    description,
  };
}
