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
 * SOURCING NOTE: the RPM ranges and monetizationScore values in
 * ../data/cpm-benchmarks.json are unsourced estimates, not verified
 * published benchmarks — no official CPM API exists (see project
 * history). Category ORDERING is directionally consistent with public
 * creator-economy reporting, but treat exact dollar figures as
 * placeholders until traced to a real source. This function's job is
 * just matching a query to a category — it doesn't fix that.
 */

/**
 * Word-boundary keyword matching, NOT substring matching.
 *
 * FIXED BUG: the previous version used `query.includes(keyword)`,
 * which matched keywords as substrings anywhere in the query. This
 * produced a confirmed false positive on real test data: "how to
 * make money on youtube" contains the substring "money" and was
 * matched to the Personal Finance category (monetizationScore: 100,
 * the best possible outcome) despite being a creator-economy/YouTube
 * growth query, not a finance query. Short keywords like "ai" were
 * also matching inside unrelated words ("contain", "explain",
 * "maintain", "domain", "certain").
 *
 * Word-boundary regex matching (\b...\b) requires the keyword to
 * appear as a whole word, not as a substring fragment.
 */
function containsKeyword(query: string, keyword: string): boolean {
  // Escape regex special characters in the keyword itself (defensive —
  // none of the current keywords need it, but a future keyword list
  // update could add one with a regex-meaningful character)
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`\\b${escaped}\\b`, 'i');
  return pattern.test(query);
}

/**
 * Looks up creator monetization RPM/CPM benchmarks for a search query.
 */
export function getMonetizationBenchmark(query: string): MonetizationResult {
  const normalizedQuery = query.toLowerCase();

  for (const b of cpmData as MonetizationBenchmark[]) {
    for (const kw of b.keywords) {
      if (containsKeyword(normalizedQuery, kw.toLowerCase())) {
        return {
          benchmark: b,
          matchedBy: 'keyword',
          matchedKeyword: kw,
        };
      }
    }
  }

  // Fallback default — reached whenever no category keyword matches
  // as a whole word. For long-tail, specific niche queries (which
  // dominate this project's real test data), this default is likely
  // hit MORE often than a real category match — see project notes on
  // keyword coverage gaps (e.g. "best gpu's to buy 2026" doesn't
  // match any current tech keyword). Expanding category keyword lists
  // to cover more real query patterns is a separate, ongoing task —
  // this default existing and firing often is not itself a bug, but
  // it does mean the monetization pressure factor currently
  // differentiates less than its 15% weight implies for most niches.
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