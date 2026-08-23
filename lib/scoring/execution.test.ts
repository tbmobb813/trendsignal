import { describe, it, expect } from 'vitest';
import { calculateExecutionFitScore, EXECUTION_QUESTIONS } from './execution';

describe('calculateExecutionFitScore', () => {
  it('calculates max score (100) and returns BEST_BET for high opportunity', () => {
    const answers = {
      edge: 'edge_deep', // 30
      depth: 'depth_easy', // 25
      capacity: 'capacity_full', // 20
      interest: 'interest_high', // 15
      audience: 'audience_direct', // 10
    };

    const result = calculateExecutionFitScore(answers, 80);

    expect(result.executionScore).toBe(100);
    expect(result.quadrant).toBe('BEST_BET');
    expect(result.quadrantColor).toBe('emerald');
    expect(result.answeredCount).toBe(5);
    expect(result.recommendedAction).toContain('Commit to a 4-video pilot batch');
  });

  it('returns STRETCH quadrant when market opportunity is high but creator fit is low', () => {
    const answers = {
      edge: 'edge_none', // 0
      depth: 'depth_struggle', // 5
      capacity: 'capacity_minimal', // 5
      interest: 'interest_low', // 3
      audience: 'audience_none', // 0
    };

    const result = calculateExecutionFitScore(answers, 75);

    expect(result.executionScore).toBe(13);
    expect(result.quadrant).toBe('STRETCH');
    expect(result.quadrantColor).toBe('amber');
    expect(result.recommendedAction).toContain('Produce 1 low-cost test video');
  });

  it('returns SAFE_GRIND quadrant when creator fit is high but market opportunity is low', () => {
    const answers = {
      edge: 'edge_deep', // 30
      depth: 'depth_easy', // 25
      capacity: 'capacity_full', // 20
      interest: 'interest_high', // 15
      audience: 'audience_direct', // 10
    };

    const result = calculateExecutionFitScore(answers, 35);

    expect(result.executionScore).toBe(100);
    expect(result.quadrant).toBe('SAFE_GRIND');
    expect(result.quadrantColor).toBe('blue');
    expect(result.recommendedAction).toContain('Find a hyper-specific sub-angle');
  });

  it('returns AVOID quadrant when both market opportunity and creator fit are low', () => {
    const answers = {
      edge: 'edge_none', // 0
      depth: 'depth_struggle', // 5
      capacity: 'capacity_minimal', // 5
      interest: 'interest_low', // 3
      audience: 'audience_none', // 0
    };

    const result = calculateExecutionFitScore(answers, 20);

    expect(result.executionScore).toBe(13);
    expect(result.quadrant).toBe('AVOID');
    expect(result.quadrantColor).toBe('rose');
    expect(result.recommendedAction).toContain('Pivot to a related sub-niche');
  });

  it('handles empty or partial answers cleanly with fallbacks', () => {
    const answers = {};

    const result = calculateExecutionFitScore(answers, 60);

    expect(result.executionScore).toBeGreaterThan(0);
    expect(result.answeredCount).toBe(0);
    expect(result.totalQuestions).toBe(EXECUTION_QUESTIONS.length);
  });
});
