import { CompetitionScoreResult } from '@/lib/scoring/types';
import { TrendsRawData } from '@/lib/trends';

export interface VideoResult {
  id: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
}

export interface SearchResponse {
  source: 'cache' | 'live';
  fetchedAt: string;
  simplifiedQuery: string;
  scoreResult: CompetitionScoreResult;
  videos: VideoResult[];
  trends: TrendsRawData | null;
  trendsWarning?: string;
}
