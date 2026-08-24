"use client";

import { SearchResponse } from "@/lib/types";
import { MonetizationCard } from "../MonetizationCard";
import {
  FormatFitCard,
  FreshnessCard,
  EngagementCard,
  RevenueDiversityCard,
  CopyrightRiskCard,
  AdvertiserSafetyCard,
} from "../SignalCards";

interface MarketTabProps {
  data: SearchResponse;
}

export function MarketTab({ data }: MarketTabProps) {
  return (
    <div className="space-y-8">
      {/* Metrics Breakdown & Monetization Grid (11 Cards) */}
      <div className="bg-zinc-900/35 border border-zinc-800/60 backdrop-blur-xl rounded-2xl p-8 shadow-lg">
        <h3 className="text-zinc-400 text-xs font-bold font-mono tracking-wider uppercase mb-6">
          Market Dynamics, Format Fit & Financials
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
          {/* 1. Demand Coverage */}
          <div className="bg-zinc-950/50 p-5 rounded-xl border border-zinc-800/40 flex flex-col justify-between">
            <div>
              <span className="text-zinc-500 text-[10px] font-bold font-mono tracking-wider uppercase block mb-1">
                Trends Demand Coverage
              </span>
              <span className="text-2xl font-black text-white">
                {data.trends ? `${Math.round(data.trends.recentDataCoverage * 100)}%` : "N/A"}
              </span>
              <p className="text-[11px] text-zinc-400 leading-relaxed mt-2.5">
                Percentage of trailing 24 months with Google Search interest signal.
              </p>
            </div>
            <div className="mt-4">
              <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-blue-500 h-full rounded-full"
                  style={{ width: `${data.trends ? data.trends.recentDataCoverage * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* 2. Authority Pressure */}
          <div className="bg-zinc-950/50 p-5 rounded-xl border border-zinc-800/40 flex flex-col justify-between">
            <div>
              <span className="text-zinc-500 text-[10px] font-bold font-mono tracking-wider uppercase block mb-1">
                Authority Pressure
              </span>
              <span className="text-2xl font-black text-white">
                {Math.round(data.scoreResult.authorityPressure * 100)}%
              </span>
              <p className="text-[11px] text-zinc-400 leading-relaxed mt-2.5">
                Subscriber mass scale of meaningful competitors. Higher pressure means established giants dominate.
              </p>
            </div>
            <div className="mt-4">
              <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-500 h-full rounded-full"
                  style={{ width: `${data.scoreResult.authorityPressure * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* 3. Concentration Pressure */}
          <div className="bg-zinc-950/50 p-5 rounded-xl border border-zinc-800/40 flex flex-col justify-between">
            <div>
              <span className="text-zinc-500 text-[10px] font-bold font-mono tracking-wider uppercase block mb-1">
                SERP Concentration (HHI)
              </span>
              <span className="text-2xl font-black text-white">
                {(data.scoreResult.concentrationPressure * 100).toFixed(1)}%
              </span>
              <p className="text-[11px] text-zinc-400 leading-relaxed mt-2.5">
                Herfindahl-Hirschman Index on top-25 result share per channel. High concentration means a few channels lock up ranking slots.
              </p>
            </div>
            <div className="mt-4">
              <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-purple-500 h-full rounded-full"
                  style={{ width: `${Math.min(100, data.scoreResult.concentrationPressure * 200)}%` }}
                />
              </div>
            </div>
          </div>

          {/* 4. Generalist Share */}
          <div className="bg-zinc-950/50 p-5 rounded-xl border border-zinc-800/40 flex flex-col justify-between">
            <div>
              <span className="text-zinc-500 text-[10px] font-bold font-mono tracking-wider uppercase block mb-1">
                Generalist Mass Share
              </span>
              <span className="text-2xl font-black text-white">
                {Math.round(data.scoreResult.generalistAuthorityShare * 100)}%
              </span>
              <p className="text-[11px] text-zinc-400 leading-relaxed mt-2.5">
                Share of competitor subscriber mass held by generalists dipping into this topic rather than focused specialists.
              </p>
            </div>
            <div className="mt-4">
              <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full"
                  style={{ width: `${data.scoreResult.generalistAuthorityShare * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* 5. Monetization Potential & RPM */}
          <MonetizationCard query={data.scoreResult.query} />

          {/* 6. Format Fit (Shorts vs Long-Form) */}
          <FormatFitCard videos={data.videos} />

          {/* 7. SERP Upload Freshness & Longevity */}
          <FreshnessCard videos={data.videos} />

          {/* 8. Audience Engagement & Loyalty */}
          <EngagementCard query={data.scoreResult.query} channels={data.scoreResult.channels} />

          {/* 9. Revenue Diversity breakdown */}
          <RevenueDiversityCard query={data.scoreResult.query} videos={data.videos} />

          {/* 10. Copyright Risk Guard */}
          <CopyrightRiskCard query={data.scoreResult.query} videos={data.videos} />

          {/* 11. Advertiser Safety Guard */}
          <AdvertiserSafetyCard query={data.scoreResult.query} videos={data.videos} />
        </div>
      </div>
    </div>
  );
}
