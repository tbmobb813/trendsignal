export interface VideoItemForFormat {
  id: string;
  title: string;
}

export type FormatType = 'SHORTS_DOMINANT' | 'LONG_FORM_FAVORED' | 'HYBRID';

export interface FormatFitResult {
  type: FormatType;
  shortsShare: number;
  longFormShare: number;
  badge: string;
  label: string;
  recommendation: string;
}

/**
 * Analyzes top YouTube search results to determine Shorts vs. Long-Form content dominance.
 */
export function analyzeFormatFit(videos: VideoItemForFormat[]): FormatFitResult {
  if (!videos || videos.length === 0) {
    return {
      type: 'HYBRID',
      shortsShare: 20,
      longFormShare: 80,
      badge: '⚖️ Hybrid Format',
      label: 'Hybrid Format Opportunity',
      recommendation: 'Produce long-form pillar videos (>8 mins) and chop key highlights into Shorts for maximum algorithmic reach.',
    };
  }

  const shortsRegex = /#shorts|#short|\bshorts\b|\breel\b|\btiktok\b/i;
  const shortsCount = videos.filter((v) => shortsRegex.test(v.title)).length;

  const shortsShare = Math.round((shortsCount / videos.length) * 100);
  const longFormShare = 100 - shortsShare;

  if (shortsShare >= 40) {
    return {
      type: 'SHORTS_DOMINANT',
      shortsShare,
      longFormShare,
      badge: `📱 Shorts Dominant (${shortsShare}%)`,
      label: 'Shorts Dominant Market',
      recommendation: 'High viral velocity in vertical video (<60s). Best for rapid subscriber acquisition, though ad RPM is lower.',
    };
  }

  if (shortsShare <= 15) {
    return {
      type: 'LONG_FORM_FAVORED',
      shortsShare,
      longFormShare,
      badge: `🎬 Long-Form Favored (${longFormShare}%)`,
      label: 'Long-Form Favored Niche',
      recommendation: 'Search results favor in-depth long-form videos (>8 mins). High session duration and maximum YouTube ad revenue.',
    };
  }

  return {
    type: 'HYBRID',
    shortsShare,
    longFormShare,
    badge: '⚖️ Hybrid Format',
    label: 'Hybrid Format Opportunity',
    recommendation: 'Balanced niche. Produce long-form pillar videos and chop key highlights into Shorts for maximum algorithmic reach.',
  };
}
