export interface ExecutionOption {
  id: string;
  label: string;
  points: number;
}

export interface ExecutionQuestion {
  id: string;
  title: string;
  subtitle: string;
  options: ExecutionOption[];
}

export type QuadrantType = 'BEST_BET' | 'STRETCH' | 'SAFE_GRIND' | 'AVOID';

export interface ExecutionResult {
  executionScore: number;
  quadrant: QuadrantType;
  quadrantTitle: string;
  quadrantBadge: string;
  quadrantColor: 'emerald' | 'amber' | 'blue' | 'rose';
  description: string;
  recommendedAction: string;
  answeredCount: number;
  totalQuestions: number;
}

export type ExecutionAnswers = Record<string, string>;

export const EXECUTION_QUESTIONS: ExecutionQuestion[] = [
  {
    id: 'edge',
    title: '1. Unfair Edge & Domain Advantage',
    subtitle: 'Do you have domain knowledge, a unique skillset, or a network in this market?',
    options: [
      {
        id: 'edge_deep',
        label: 'Deep domain expertise, specialized professional background, or direct industry network access',
        points: 30,
      },
      {
        id: 'edge_hands_on',
        label: 'Solid hands-on hobbyist experience and strong practical familiarity with key concepts',
        points: 20,
      },
      {
        id: 'edge_learning',
        label: 'Beginner level — learning in public or researching as I create content',
        points: 10,
      },
      {
        id: 'edge_none',
        label: 'No prior experience or edge; choosing purely based on perceived trend opportunity',
        points: 0,
      },
    ],
  },
  {
    id: 'depth',
    title: '2. Topic Depth & Durability (The 20-Idea Test)',
    subtitle: 'Can you write down 20 specific video titles/topics in this niche right now in 10 minutes without Googling?',
    options: [
      {
        id: 'depth_easy',
        label: 'Easily — I have dozens of specific video concepts and unique angles ready to produce',
        points: 25,
      },
      {
        id: 'depth_moderate',
        label: 'Probably 10–15 solid concepts before needing external topic research',
        points: 15,
      },
      {
        id: 'depth_struggle',
        label: 'Fewer than 10 — I would need to rely heavily on copying existing competitor titles',
        points: 5,
      },
    ],
  },
  {
    id: 'capacity',
    title: '3. Production Capacity & Gear',
    subtitle: 'Do you have the tools, equipment, and time required for this niche’s typical video format?',
    options: [
      {
        id: 'capacity_full',
        label: 'Fully equipped — own gear/software & can sustain 1–2 polished videos per week',
        points: 20,
      },
      {
        id: 'capacity_sufficient',
        label: 'Sufficient setup — can produce baseline quality on a bi-weekly schedule',
        points: 12,
      },
      {
        id: 'capacity_minimal',
        label: 'Minimal setup/time — production will be a struggle or require heavy outsourcing',
        points: 5,
      },
    ],
  },
  {
    id: 'interest',
    title: '4. Genuine Interest & Resiliency',
    subtitle: 'How interested are you in producing 30+ videos on this topic even if initial traction is slow?',
    options: [
      {
        id: 'interest_high',
        label: 'Highly passionate — I enjoy discussing and creating this content regardless of initial views',
        points: 15,
      },
      {
        id: 'interest_moderate',
        label: 'Moderately interested — I like the topic enough to stick with it consistently for 6 months',
        points: 10,
      },
      {
        id: 'interest_low',
        label: 'Low interest — pursuing this primarily for fast financial gain or trend chasing',
        points: 3,
      },
    ],
  },
  {
    id: 'audience',
    title: '5. Audience & Distribution Transfer',
    subtitle: 'Do you have an existing channel, mailing list, or social following that overlaps with this niche?',
    options: [
      {
        id: 'audience_direct',
        label: 'Yes — active channel/following with direct audience overlap in this category',
        points: 10,
      },
      {
        id: 'audience_adjacent',
        label: 'Partial — existing audience in an adjacent or broader topic area',
        points: 5,
      },
      {
        id: 'audience_none',
        label: 'Cold start — starting from 0 subscribers with no existing audience distribution',
        points: 0,
      },
    ],
  },
];

/**
 * Calculates the Execution Fit Score (0-100) and plots the 2x2 Matrix position.
 * @param answers Map of questionId -> optionId
 * @param nicheOpportunityScore Market Niche Opportunity score (0-100)
 */
export function calculateExecutionFitScore(
  answers: ExecutionAnswers,
  nicheOpportunityScore: number
): ExecutionResult {
  let totalScore = 0;
  let answeredCount = 0;

  EXECUTION_QUESTIONS.forEach((q) => {
    const selectedOptionId = answers[q.id];
    if (selectedOptionId) {
      const option = q.options.find((o) => o.id === selectedOptionId);
      if (option) {
        totalScore += option.points;
        answeredCount += 1;
      }
    } else {
      // Default to middle option score if not explicitly answered yet
      const fallbackPoints = q.options[Math.floor(q.options.length / 2)]?.points || 0;
      totalScore += fallbackPoints;
    }
  });

  const executionScore = Math.min(100, Math.max(0, Math.round(totalScore)));

  const isHighOpportunity = nicheOpportunityScore >= 50;
  const isHighExecution = executionScore >= 50;

  if (isHighOpportunity && isHighExecution) {
    return {
      executionScore,
      quadrant: 'BEST_BET',
      quadrantTitle: 'Best Bet',
      quadrantBadge: '🚀 High Market Demand & Strong Creator Edge',
      quadrantColor: 'emerald',
      description:
        'High market opportunity paired with strong personal edge and production capacity. Perfect candidate for aggressive investment.',
      recommendedAction:
        'Commit to a 4-video pilot batch over the next 30 days. Target a specific sub-topic angle and track 30-day view velocity and retention on video 1.',
      answeredCount,
      totalQuestions: EXECUTION_QUESTIONS.length,
    };
  }

  if (isHighOpportunity && !isHighExecution) {
    return {
      executionScore,
      quadrant: 'STRETCH',
      quadrantTitle: 'Stretch Opportunity',
      quadrantBadge: '🧗 High Market Demand, Needs Skill / Gear Building',
      quadrantColor: 'amber',
      description:
        'The market is open and lucrative, but your current gear, topic depth, or production bandwidth may constrain output.',
      recommendedAction:
        'Produce 1 low-cost test video in the next 14 days using your existing setup. Validate audience demand before buying gear or outsourcing.',
      answeredCount,
      totalQuestions: EXECUTION_QUESTIONS.length,
    };
  }

  if (!isHighOpportunity && isHighExecution) {
    return {
      executionScore,
      quadrant: 'SAFE_GRIND',
      quadrantTitle: 'Safe Grind',
      quadrantBadge: '⛏️ Strong Personal Edge, Tight / Saturated Market',
      quadrantColor: 'blue',
      description:
        'You have deep knowledge or gear for this niche, but market competition is high or search volume is flat. Success requires strong differentiation.',
      recommendedAction:
        'Find a hyper-specific sub-angle that generalist competitors ignore. Make 1 test video targeting an underserved long-tail search term.',
      answeredCount,
      totalQuestions: EXECUTION_QUESTIONS.length,
    };
  }

  return {
    executionScore,
    quadrant: 'AVOID',
    quadrantTitle: 'Avoid / Pivot',
    quadrantBadge: '🛑 Low Market Demand & Low Creator Fit',
    quadrantColor: 'rose',
    description:
      'Low market opportunity combined with limited personal edge. High risk of burnout with low likelihood of return on investment.',
    recommendedAction:
      'Pivot to a related sub-niche or choose a different market where your unique skills, network, and interest provide a stronger advantage.',
    answeredCount,
    totalQuestions: EXECUTION_QUESTIONS.length,
  };
}
