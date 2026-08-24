import { describe, it, expect, vi } from 'vitest';
import { fetchExecutiveSynthesis, SynthesisInput } from './synthesis-llm';

describe('LLM Executive Synthesis Module', () => {
  const mockInput: SynthesisInput = {
    query: 'budget meal prep',
    opportunityScore: 78,
    executionScore: 85,
    quadrant: 'Best Bet',
    rpmRange: '$4.00 – $9.50',
    lifecycle: '🚀 Early Rising (+35% 6mo)',
    formatFit: '🎬 Long-Form Favored (80%)',
    automation: '🤖 Moderate Faceless (60%)',
    safety: '🟢 100% Advertiser Friendly',
    copyright: '🟢 100% Original Footage',
  };

  it('falls back to rule-based synthesis if OpenRouter API key is missing or invalid', async () => {
    // We expect it to fallback and complete successfully rather than throwing an error
    const res = await fetchExecutiveSynthesis(mockInput);
    expect(res.provider).toBe('local-fallback');
    expect(res.executiveSummary.length).toBe(3);
    expect(res.pilotVideoBlueprint.titleIdeas.length).toBe(3);
  });

  it('correctly uses API response and parses JSON when OpenRouter key is present', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-v1-testkey';
    const mockApiResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              executiveSummary: [
                'Data point one',
                'Data point two',
                'Data point three'
              ],
              pilotVideoBlueprint: {
                titleIdeas: ['Title 1', 'Title 2', 'Title 3'],
                concept: 'Mock concept pitch',
                outline: ['Step 1', 'Step 2'],
                productionStrategy: 'Test production strategy'
              }
            })
          }
        }
      ]
    };

    const globalFetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockApiResponse)
    });
    
    const originalFetch = global.fetch;
    global.fetch = globalFetchSpy;

    try {
      const res = await fetchExecutiveSynthesis(mockInput);
      expect(res.provider).toBe('openrouter');
      expect(res.executiveSummary).toEqual(['Data point one', 'Data point two', 'Data point three']);
      expect(res.pilotVideoBlueprint.concept).toBe('Mock concept pitch');
      expect(res.pilotVideoBlueprint.titleIdeas).toEqual(['Title 1', 'Title 2', 'Title 3']);
    } finally {
      global.fetch = originalFetch;
      delete process.env.OPENROUTER_API_KEY;
    }
  });
});
