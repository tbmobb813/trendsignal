import cpmData from '../data/cpm-benchmarks.json';

export interface MonetizationBenchmark {
  id: string;
  category: string;
  cpmTier: 'HIGH' | 'MEDIUM' | 'LOW';
  rpmRange: string;
  monetizationScore: number; // 0-100
  affiliatePotential: string;
  keywords: string[];
}

export interface MonetizationResult {
  benchmark: MonetizationBenchmark;
  matchedBy: 'keyword' | 'default';
  matchedKeyword?: string;
}

/**
 * Looks up creator monetization RPM/CPM benchmarks for a search query.
 */
export function getMonetizationBenchmark(query: string): MonetizationResult {
  const normalizedQuery = query.toLowerCase();

  for (const b of cpmData as MonetizationBenchmark[]) {
    for (const kw of b.keywords) {
      if (normalizedQuery.includes(kw)) {
        return {
          benchmark: b,
          matchedBy: 'keyword',
          matchedKeyword: kw,
        };
      }
    }
  }

  // Fallback default
  const defaultBenchmark: MonetizationBenchmark = {
    id: 'default',
    category: 'General Interest / Niche Topic',
    cpmTier: 'MEDIUM',
    rpmRange: '$5.00 – $10.00',
    monetizationScore: 55,
    affiliatePotential: 'Moderate (Amazon Associates, digital products, targeted sponsorships).',
    keywords: [],
  };

  return {
    benchmark: defaultBenchmark,
    matchedBy: 'default',
  };
}
