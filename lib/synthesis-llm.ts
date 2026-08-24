export interface SynthesisResult {
  executiveSummary: string[];
  pilotVideoBlueprint: {
    titleIdeas: string[];
    concept: string;
    outline: string[];
    productionStrategy: string;
  };
  provider: 'openrouter' | 'local-fallback';
}

export interface SynthesisInput {
  query: string;
  opportunityScore: number;
  executionScore: number;
  quadrant: string;
  rpmRange: string;
  lifecycle: string;
  formatFit: string;
  automation: string;
  safety: string;
  copyright: string;
}

const SYSTEM_PROMPT = `You are an expert YouTube niche growth strategist.
Synthesize the provided niche market data into a 3-bullet executive summary and a 2-week pilot video blueprint.
Your advice must be highly specific, practical, and tailored to the query vertical.

You MUST return ONLY a valid JSON object with the following structure (no markdown fences, no wrapping, no conversational prefix/suffix):
{
  "executiveSummary": [
    "bullet 1 (max 100 characters - punchy, data-backed insight)",
    "bullet 2 (max 100 characters - key competitive/monetization reality)",
    "bullet 3 (max 100 characters - execution or entry-point strategic verdict)"
  ],
  "pilotVideoBlueprint": {
    "titleIdeas": [
      "Title Option 1 (designed for high Click-Through-Rate)",
      "Title Option 2 (SEO long-tail focus)",
      "Title Option 3 (curiosity/authority trigger)"
    ],
    "concept": "1-sentence elevator pitch for the first pilot test video",
    "outline": [
      "Intro: hook and core viewer problem (0-60s)",
      "Body: step-by-step value delivery or screen demo",
      "Outro: CTA and next video link recommendation"
    ],
    "productionStrategy": "Specific recommendation based on automation potential, barrier to entry, and copyright safety."
  }
}`;

function getLocalFallbackSynthesis(input: SynthesisInput): SynthesisResult {
  return {
    executiveSummary: [
      `Opportunity Score is ${input.opportunityScore}/100, indicating a "${input.quadrant}" execution verdict.`,
      `Monetizes at an estimated ${input.rpmRange} RPM; advertiser safety rating is classified as ${input.safety}.`,
      `Content is ${input.formatFit} and suitable for a ${input.automation} production model.`
    ],
    pilotVideoBlueprint: {
      titleIdeas: [
        `How to Get Started with ${input.query} (Step-by-Step Tutorial)`,
        `The Hidden Cost of ${input.query} & How to Avoid It`,
        `5 ${input.query} Rules Every Beginner Needs to Know`
      ],
      concept: `A highly structured beginner guide to ${input.query} addressing the primary entry-level friction points.`,
      outline: [
        "0:00 - 1:00: Hook the viewer by showing the final desired outcome.",
        "1:00 - 7:00: Step-by-step breakdown of the core setup or technique.",
        "7:00 - 8:30: Summary of mistakes to avoid and call-to-action for comments."
      ],
      productionStrategy: `Produce using a ${input.automation.toLowerCase()} setup. Emphasize original footage to satisfy ${input.copyright.toLowerCase()} criteria.`
    },
    provider: 'local-fallback'
  };
}

/**
 * Sanitizes input query string to mitigate prompt injection risks.
 */
function sanitizeQuery(q: string): string {
  if (!q) return '';
  // Truncate to 100 characters max
  let clean = q.substring(0, 100);
  // Strip control characters, backticks, newlines, carriage returns
  clean = clean.replace(/[\r\n\t`]+/g, ' ');
  // Collapse multiple spaces
  clean = clean.replace(/\s+/g, ' ').trim();
  // Remove common prompt injection pattern triggers
  clean = clean.replace(/ignore\s+previous\s+instructions/gi, '');
  clean = clean.replace(/system\s+prompt/gi, '');
  return clean;
}

/**
 * Generates LLM executive synthesis and pilot video blueprint from niche signals.
 */
export async function fetchExecutiveSynthesis(input: SynthesisInput): Promise<SynthesisResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || apiKey === 'sk-or-v1-...' || apiKey.includes('placeholder')) {
    return getLocalFallbackSynthesis(input);
  }

  const sanitizedQuery = sanitizeQuery(input.query);

  const promptInput = `
  Niche Search Term: "${sanitizedQuery}"
  Opportunity Score: ${input.opportunityScore}/100
  Creator Execution Fit: ${input.executionScore}/100
  Strategic Quadrant Verdict: "${input.quadrant}"
  Estimated Monetization RPM: ${input.rpmRange}
  Trend Lifecycle: "${input.lifecycle}"
  SERP Format Fit: "${input.formatFit}"
  AI Automation Feasibility: "${input.automation}"
  Advertiser Safety Guard: "${input.safety}"
  Copyright/Content ID Risk: "${input.copyright}"
  `;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'TrendSignal',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        max_tokens: 300,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: promptInput },
        ],
      }),
    });

    if (!response.ok) {
      return getLocalFallbackSynthesis(input);
    }

    const data = await response.json();
    let text = data?.choices?.[0]?.message?.content?.trim();

    if (!text) {
      return getLocalFallbackSynthesis(input);
    }

    // Strip markdown JSON fencing if present
    if (text.startsWith('```json')) {
      text = text.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (text.startsWith('```')) {
      text = text.replace(/^```/, '').replace(/```$/, '').trim();
    }

    const parsed = JSON.parse(text);

    if (
      Array.isArray(parsed?.executiveSummary) &&
      parsed.executiveSummary.length > 0 &&
      parsed?.pilotVideoBlueprint?.titleIdeas
    ) {
      return {
        executiveSummary: parsed.executiveSummary.slice(0, 3),
        pilotVideoBlueprint: {
          titleIdeas: parsed.pilotVideoBlueprint.titleIdeas.slice(0, 3),
          concept: parsed.pilotVideoBlueprint.concept || `A growth strategy overview for ${input.query}.`,
          outline: parsed.pilotVideoBlueprint.outline || [],
          productionStrategy: parsed.pilotVideoBlueprint.productionStrategy || "",
        },
        provider: 'openrouter',
      };
    }

    return getLocalFallbackSynthesis(input);
  } catch {
    return getLocalFallbackSynthesis(input);
  }
}
