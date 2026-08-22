/**
 * LLM-based query simplifier: reduces a YouTube-style descriptive
 * search phrase to something closer to how a person would actually
 * type a search into Google, for use with the Trends lookup.
 *
 * WHY THIS EXISTS: confirmed via real testing that phrase length
 * alone determines whether Trends returns real coverage — "japanese
 * chisel sharpening" got 0%, "chisel sharpening" got 100%, same real
 * topic. The rule-based simplifier (query-simplifier.ts) catches
 * generic qualifier patterns ("for beginners", "techniques") but has
 * a hard ceiling: domain-specific compound phrases need actual
 * judgment about which word to drop, not just edge-trimming.
 *
 * MULTI-PROVIDER: tries each configured provider in order (Anthropic
 * native API, then OpenRouter) and uses the first one that returns a
 * plausible result. This exists because relying on a single provider
 * means a single point of failure — an invalid key, an outage, or a
 * rate limit on one provider shouldn't take down query simplification
 * entirely when a second option is available. Only when EVERY
 * configured provider fails (or none are configured) does this drop
 * to the rule-based fallback.
 *
 * NOT INDEPENDENTLY VERIFIED: unlike every other piece built in this
 * project, this file could not be tested against a real API call —
 * no working API key was available in the build environment. The
 * request/response shapes follow each provider's documented format,
 * but actual model output quality is UNTESTED. Run
 * scripts/test-llm-simplifier.ts before trusting this in the live
 * pipeline — do not assume it works just because it compiles.
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

export class QuerySimplifierError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'QuerySimplifierError';
  }
}

/**
 * Cheap sanity checks before trusting model output — not a
 * correctness guarantee, just a filter against obviously broken
 * responses (empty, commentary instead of a bare phrase, suspiciously
 * expanded rather than shortened).
 */
function isPlausibleSimplification(original: string, candidate: string): boolean {
  const trimmed = candidate.trim();
  if (trimmed.length < 2 || trimmed.length > 100) return false;
  if (/[:."]|^\s*here|^\s*sure|^\s*the\s+simplified/i.test(trimmed)) return false;
  if (trimmed.split(/\s+/).length > original.trim().split(/\s+/).length + 1) return false;
  return true;
}

interface ProviderResult {
  text: string;
  provider: string;
}

async function callAnthropic(query: string): Promise<ProviderResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new QuerySimplifierError('ANTHROPIC_API_KEY not set');
  }

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
    const body = await response.text().catch(() => '');
    throw new QuerySimplifierError(`Anthropic API returned ${response.status}: ${body}`);
  }

  const data = await response.json();
  const text = data?.content?.[0]?.text?.trim();

  if (!text || !isPlausibleSimplification(query, text)) {
    throw new QuerySimplifierError(`Anthropic returned implausible result: "${text}"`);
  }

  return { text: text.toLowerCase(), provider: 'anthropic' };
}

async function callOpenRouter(query: string): Promise<ProviderResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new QuerySimplifierError('OPENROUTER_API_KEY not set');
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'TrendSignal',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-haiku-4.5',
      max_tokens: 30,
      temperature: 0,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: query },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new QuerySimplifierError(`OpenRouter API returned ${response.status}: ${body}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content?.trim();

  if (!text || !isPlausibleSimplification(query, text)) {
    throw new QuerySimplifierError(`OpenRouter returned implausible result: "${text}"`);
  }

  return { text: text.toLowerCase(), provider: 'openrouter' };
}

/**
 * Provider attempt order. Anthropic first (native API, typically
 * lower latency when it works), OpenRouter second. Override with
 * LLM_PROVIDER_ORDER="openrouter,anthropic" in env if you want the
 * reverse — comma-separated, unrecognized names are ignored.
 */
function getProviderOrder(): Array<(q: string) => Promise<ProviderResult>> {
  const providers: Record<string, (q: string) => Promise<ProviderResult>> = {
    anthropic: callAnthropic,
    openrouter: callOpenRouter,
  };

  const configuredOrder = process.env.LLM_PROVIDER_ORDER?.split(',').map((s) => s.trim().toLowerCase());
  const order = configuredOrder?.filter((name) => name in providers) ?? ['anthropic', 'openrouter'];

  return order.length > 0 ? order.map((name) => providers[name]) : [callAnthropic, callOpenRouter];
}

/**
 * Simplify a query for Trends lookup. Tries each configured provider
 * in order, falling back to the rule-based simplifier only when every
 * provider fails or none are configured. Never throws.
 */
export async function simplifyQueryWithLLM(query: string): Promise<string> {
  const providers = getProviderOrder();
  const errors: string[] = [];

  for (const callProvider of providers) {
    try {
      const result = await callProvider(query);
      console.log(`Query simplified via ${result.provider}: "${query}" -> "${result.text}"`);
      return result.text;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(message);
      console.warn(`LLM provider attempt failed, trying next: ${message}`);
    }
  }

  console.warn(
    `All LLM providers failed (${errors.join(' | ')}) — falling back to rule-based query simplifier.`
  );
  const { simplifyQueryForTrends } = await import('./query-simplifier');
  return simplifyQueryForTrends(query);
}