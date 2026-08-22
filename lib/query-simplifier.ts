/**
 * Converts a YouTube-style descriptive search query into a shorter
 * phrase more likely to match real Google search behavior for
 * Trends lookups.
 *
 * Confirmed via real testing (see scripts/test-short-queries.ts):
 * "japanese chisel sharpening" (0% Trends coverage) vs
 * "chisel sharpening" (100%) — same real-world topic, only the
 * phrase length differs. This is NOT a Trends reliability problem;
 * it's a mismatch between how YouTube video titles are phrased
 * (long, descriptive) and how people actually type into Google
 * search (short, core terms).
 *
 * THIS IS A HEURISTIC, NOT A SOLVED PROBLEM. It's a maintained list
 * of common qualifier patterns, not a general-purpose NLP simplifier.
 * It will miss cases and over-simplify others. A more robust v2 would
 * use an LLM call to do this reduction ("how would someone actually
 * search Google for this") — worth revisiting if this rule-based
 * version proves too fragile once used on real, unpredictable user
 * queries rather than the curated test set it was built against.
 */

const LEADING_QUALIFIERS = [
  'how to ',
  'best ',
  'beginner ',
  "beginner's ",
  'beginners ',
  "beginner's guide to ",
  'top ',
  'ultimate guide to ',
  'complete guide to ',
];

const TRAILING_QUALIFIERS = [
  ' for beginners',
  ' techniques',
  ' technique',
  ' tutorial',
  ' tutorials',
  ' guide',
  ' guides',
  ' tips',
  ' 101',
  ' explained',
  ' basics',
  ' for dummies',
  ' step by step',
  ' walkthrough',
];

export function simplifyQueryForTrends(query: string): string {
  let simplified = query.trim().toLowerCase();

  // Strip trailing qualifiers first (order matters less here, but do
  // it before leading so "best X for beginners" strips both ends)
  for (const suffix of TRAILING_QUALIFIERS) {
    if (simplified.endsWith(suffix)) {
      simplified = simplified.slice(0, -suffix.length).trim();
    }
  }

  for (const prefix of LEADING_QUALIFIERS) {
    if (simplified.startsWith(prefix)) {
      simplified = simplified.slice(prefix.length).trim();
    }
  }

  // Safety net: never return an empty string — fall back to the
  // original query if stripping left nothing usable.
  return simplified.length >= 2 ? simplified : query.trim().toLowerCase();
}
