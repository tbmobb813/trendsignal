/**
 * LLM-based query simplifier: reduces a YouTube-style descriptive
 * search phrase to something closer to how a person would actually
 * type a search into Google, for use with the Trends lookup.
 *
 * WHY THIS EXISTS: confirmed via real testing (see
 * scripts/test-short-queries.ts and the rule-based version's results)
 * that phrase length alone determines whether Trends returns real
 * coverage — "japanese chisel sharpening" got 0%, "chisel sharpening"
 * got 100%, same real topic. The rule-based simplifier
 * (query-simplifier.ts) catches generic qualifier patterns ("for
 * beginners", "techniques") but has a hard ceiling: domain-specific
 * compound phrases ("japanese chisel sharpening", "custom mechanical
 * keyboard soldering") need actual judgment about which word to drop,
 * not just edge-trimming — a fixed word list can't do that reliably
 * for unbounded real-world queries.
 *
 * NOT INDEPENDENTLY VERIFIED: unlike every other piece built in this
 * project, this file could not be tested against a real API call —
 * no Anthropic API key was available in the build environment. The
 * request/response shape and error handling follow the same pattern
 * validated elsewhere in this codebase, but the actual model output
 * quality is UNTESTED. Run scripts/test-llm-simplifier.ts (once
 * ANTHROPIC_API_KEY is set) before trusting this in the live pipeline
 * — do not assume it works just because it compiles.
 */

const SYSTEM_PROMPT = `You reduce a YouTube video search phrase to the shortest form someone would realistically type into Google search, while keeping the core topic intact.

Rules:
- Output ONLY the simplified phrase. No explanation, no quotes, no punctuation beyond what's in the phrase itself.
- Keep it to the essential 2-4 word core concept.
- Drop generic qualifiers like "for beginners", "tutorial", "guide", "tips", "how to", "best", "techniques" if present.
- Drop descriptive adjectives (nationality, brand, material, style) ONLY if the core concept is still clearly identifiable without them — e.g. "japanese chisel sharpening" -> "chisel sharpening", but keep adjectives that ARE the core concept — e.g. "cast iron seasoning" should stay as-is, don't strip "cast iron".
- Never invent words that weren't in or clearly implied by the original phrase.
- If the phrase is already short and simple, return it unchanged (lowercased).

Examples:
"japanese chisel sharpening" -> "chisel sharpening"
"custom mechanical keyboard soldering" -> "keyboard soldering"
"restoring vintage mechanical calculators" -> "vintage calculator restoration"
"meal prep for night shift nurses" -> "night shift meal prep"
"best budget 3d printer upgrades" -> "3d printer upgrades"
"cast iron seasoning for beginners" -> "cast iron seasoning"
"budget meal prep" -> "budget meal prep"`;

class QuerySimplifierError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'QuerySimplifierError';
  }
}

/**
 * Validates that the model's output looks like a plausible simplified
 * query rather than a broken/hallucinated response — cheap sanity
 * checks before trusting it, not a guarantee of correctness.
 */
function isPlausibleSimplification(original: string, candidate: string): boolean {
  const trimmed = candidate.trim();
  if (trimmed.length < 2 || trimmed.length > 100) return false;
  // Reject anything that looks like the model added commentary
  // (a colon, a full sentence, quotes around the whole thing)
  if (/[:."]|^\s*here|^\s*sure|^\s*the\s+simplified/i.test(trimmed)) return false;
  // Reject if it's suspiciously longer than the original — the point
  // is to shorten, not expand
  if (trimmed.split(/\s+/).length > original.trim().split(/\s+/).length + 1) return false;
  return true;
}

/**
 * Calls Claude to simplify a query for Trends lookup. Falls back to
 * the rule-based simplifier (imported lazily to avoid a circular
 * import at module load time) on ANY failure — missing API key,
 * network error, implausible output. This function is designed to
 * never throw; a broken LLM call should degrade to the rule-based
 * version, not break the pipeline.
 */
export async function simplifyQueryWithLLM(query: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.warn('ANTHROPIC_API_KEY not set — falling back to rule-based query simplifier.');
    const { simplifyQueryForTrends } = await import('./query-simplifier');
    return simplifyQueryForTrends(query);
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 30,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: query }],
        temperature: 0,
      }),
    });

    if (!response.ok) {
      throw new QuerySimplifierError(`Anthropic API returned ${response.status}`);
    }

    const data = await response.json();
    const text = data?.content?.[0]?.text?.trim();

    if (!text || !isPlausibleSimplification(query, text)) {
      throw new QuerySimplifierError(`Implausible or empty simplification result: "${text}"`);
    }

    return text.toLowerCase();
  } catch (err) {
    console.warn(`LLM query simplification failed, falling back to rule-based: ${err instanceof Error ? err.message : err}`);
    const { simplifyQueryForTrends } = await import('./query-simplifier');
    return simplifyQueryForTrends(query);
  }
}

export { QuerySimplifierError };
