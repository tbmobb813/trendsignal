import { YouTubeNicheRawData, YouTubeChannelStats } from '../youtube';

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
  /** meaningfulCompetitorCount - specialistCompetitorCount. Large gap = niche looks crowded
   *  at a glance but is actually dominated by generalists dipping in, not owned by specialists. */
  generalistDipInGap: number;
  /** Median video output among meaningful (non-thin) channels — proxy for how much sustained
   *  effort it takes to compete here. */
  medianVideoCount: number;
  /** 0-100. Higher = more room for a new dedicated channel. See computeCompetitionScore for the formula and its caveats. */
  score: number;
  notes: string[];
}
