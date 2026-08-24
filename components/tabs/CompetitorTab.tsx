"use client";

import { SearchResponse } from "@/lib/types";

interface CompetitorTabProps {
  data: SearchResponse;
}

export function CompetitorTab({ data }: CompetitorTabProps) {
  const formatNumber = (num: number | null) => {
    if (num === null) return "Hidden";
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
    return num.toLocaleString();
  };

  return (
    <div className="space-y-8">
      <div className="bg-zinc-900/35 border border-zinc-800/60 backdrop-blur-xl rounded-2xl p-8 shadow-lg">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
          <div>
            <h3 className="text-zinc-400 text-xs font-bold font-mono tracking-wider uppercase block">
              Top Competitor Channels & SERP Breakdown
            </h3>
            <span className="text-xs text-zinc-500 mt-1 block">
              Showing {data.scoreResult.channels.length} channels extracted from top search results
            </span>
          </div>
        </div>

        {/* Channel Table / Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.scoreResult.channels.map((channel) => {
            return (
              <div
                key={channel.channelId}
                className={`p-5 rounded-xl border transition-all flex flex-col justify-between ${
                  channel.isGeneralistSuspected
                    ? 'bg-amber-500/5 border-amber-500/20'
                    : channel.isViralOutlier
                    ? 'bg-purple-500/5 border-purple-500/20'
                    : channel.isThin
                    ? 'bg-zinc-950/30 border-zinc-800/40 opacity-70'
                    : 'bg-zinc-950/60 border-zinc-800/80'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h4 className="font-bold text-sm text-white line-clamp-1">
                      {channel.title}
                    </h4>
                    {/* Badges */}
                    <div className="flex flex-wrap gap-1 shrink-0">
                      {channel.isGeneralistSuspected && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/30 text-[10px] font-bold text-amber-300">
                          Generalist
                        </span>
                      )}
                      {channel.isViralOutlier && (
                        <span className="px-2 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/30 text-[10px] font-bold text-purple-300">
                          Viral Outlier
                        </span>
                      )}
                      {channel.isThin && (
                        <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-[10px] font-mono text-zinc-400">
                          Thin
                        </span>
                      )}
                      {!channel.isGeneralistSuspected && !channel.isThin && !channel.isViralOutlier && (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-bold text-emerald-400">
                          Specialist
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs text-zinc-400 mb-4">
                    <div>
                      <span className="text-[10px] font-mono text-zinc-500 uppercase block mb-1">Subscribers</span>
                      <span className="font-bold text-zinc-200">{formatNumber(channel.subscriberCount)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-zinc-500 uppercase block mb-1">Video Count</span>
                      <span className="font-bold text-zinc-200">{channel.videoCount}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-zinc-500 uppercase block mb-1">Avg Views/Vid</span>
                      <span className="font-bold text-zinc-200">{formatNumber(Math.round(channel.viewsPerVideo))}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-zinc-500 uppercase block mb-1">Views/Sub</span>
                      <span className="font-bold text-zinc-200">{channel.viewsPerSubscriber ? channel.viewsPerSubscriber.toFixed(1) : 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <a
                  href={`https://youtube.com/channel/${channel.channelId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white transition-all text-center"
                  aria-label={`View ${channel.title} on YouTube`}
                >
                  <span>View YouTube Channel</span>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
