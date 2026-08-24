/** Derived per-channel metrics computed from raw stats. */
export interface ChannelMetrics {
  channelId: string;
  title: string;
  subscriberCount: number | null;
  videoCount: number;
  viewCount: number;
  viewsPerVideo: number;
  viewsPerSubscriber: number | null; // null when subscriberCount is null
  /** Too small/new to be a meaningful comparable — excluded from ratio-based scoring. */
  isThin: boolean;
  /** Views-per-video is a statistical outlier relative to this niche's other channels. */
  isViralOutlier: boolean;
  /** Appears across enough unrelated past queries to be treated as a generalist, not a niche specialist. */
  isGeneralistSuspected: boolean;
  /** How many distinct past queries this channel has appeared in (0 if no history yet). */
  crossQueryAppearances: number;
}

export interface CompetitionScoreResult {
  query: string;
  /** All channels behind the top search results, with derived metrics attached. */
  channels: ChannelMetrics[];
  /** Count of unique channels, unfiltered. */
  rawCompetitorCount: number;
  /** Count excluding thin/noise channels. */
  meaningfulCompetitorCount: number;
  /** Count excluding thin channels AND suspected generalists — the real specialist competition. */
  specialistCompetitorCount: number;
  /** meaningfulCompetitorCount - specialistCompetitorCount. Informational only as of v2 —
   *  no longer drives the score directly (see generalistAuthorityShare). */
  generalistDipInGap: number;
  /** Median video output among meaningful (non-thin) channels. */
  medianVideoCount: number;
  /**
   * 0-1. Median log-scaled subscriber count among meaningful channels, normalized.
   * Higher = the field is dominated by larger channels generally (independent of
   * whether they're flagged generalist).
   */
  authorityPressure: number;
  /**
   * 0-1. Min-max rescaled from the raw Herfindahl-Hirschman Index on
   * search-result share per channel (raw HHI is compressed into a tiny
   * band in practice — see CONCENTRATION_MIN/MAX in competition.ts —
   * so this is NOT the raw HHI value itself). Higher = a small number
   * of channels own a large share of the actual ranking positions —
   * the "monthly GPU update video" pattern, where a few channels
   * systematically dominate the SERP through repeat/frequent presence,
   * independent of their size.
   */
  concentrationPressure: number;
  /**
   * 0-1. Share of total subscriber mass (among meaningful channels) held by
   * generalist-suspected channels specifically. This is the fix for the v1 bug:
   * "how to invest for beginners" has few generalists by headcount but they hold
   * enormous subscriber mass — this metric captures that; the old headcount-based
   * generalistDipInGap didn't.
   */
  generalistAuthorityShare: number;
  /** 0-100. Higher = more room for a new dedicated channel. See computeCompetitionScore for the formula. */
  score: number;
  notes: string[];
}

