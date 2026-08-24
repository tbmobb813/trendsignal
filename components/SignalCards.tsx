"use client";

import { analyzeFormatFit, VideoItemForFormat } from "@/lib/scoring/format-fit";
import { evaluateAutomationFeasibility } from "@/lib/scoring/automation";
import { evaluateAdvertiserSafety } from "@/lib/scoring/advertiser-safety";
import { analyzeSerpFreshness, VideoItemForFreshness } from "@/lib/scoring/freshness";
import { evaluateEngagementDensity } from "@/lib/scoring/engagement";
import { evaluateBarrierToEntry } from "@/lib/scoring/barrier-entry";
import { calculateRevenueDiversity } from "@/lib/scoring/revenue-diversity";
import { evaluateCopyrightRisk } from "@/lib/scoring/copyright-risk";
import { evaluateThumbnailDensity } from "@/lib/scoring/thumbnail-density";
import { VideoResult } from "@/lib/types";
import { ChannelMetrics } from "@/lib/scoring/types";

interface FormatFitCardProps {
  videos: VideoItemForFormat[];
}

export function FormatFitCard({ videos }: FormatFitCardProps) {
  const result = analyzeFormatFit(videos);

  return (
    <div className="bg-zinc-950/50 p-5 rounded-xl border border-zinc-800/40 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-zinc-500 text-[10px] font-bold font-mono tracking-wider uppercase block">
            Format Fit Ratio <span className="text-emerald-500/80 font-normal">(&bull; SERP Analyzed)</span>
          </span>
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
            result.type === 'SHORTS_DOMINANT'
              ? 'bg-purple-500/10 border border-purple-500/30 text-purple-300'
              : result.type === 'LONG_FORM_FAVORED'
              ? 'bg-blue-500/10 border border-blue-500/30 text-blue-300'
              : 'bg-zinc-800 text-zinc-300'
          }`}>
            {result.type === 'SHORTS_DOMINANT' ? 'Shorts' : result.type === 'LONG_FORM_FAVORED' ? 'Long-Form' : 'Hybrid'}
          </span>
        </div>

        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-xl font-black text-white">{result.badge}</span>
        </div>

        <p className="text-[11px] text-zinc-400 leading-relaxed mt-2">
          {result.recommendation}
        </p>
      </div>

      <div className="mt-4">
        <div className="flex justify-between text-[10px] font-mono text-zinc-500 mb-1">
          <span>Shorts ({result.shortsShare}%)</span>
          <span>Long-Form ({result.longFormShare}%)</span>
        </div>
        <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden flex">
          <div
            className="bg-purple-500 h-full transition-all"
            style={{ width: `${result.shortsShare}%` }}
          />
          <div
            className="bg-blue-500 h-full transition-all"
            style={{ width: `${result.longFormShare}%` }}
          />
        </div>
      </div>
    </div>
  );
}

interface AutomationCardProps {
  query: string;
  videos: VideoResult[];
}

export function AutomationCard({ query, videos }: AutomationCardProps) {
  const result = evaluateAutomationFeasibility(query, videos);

  return (
    <div className="bg-zinc-950/50 p-6 rounded-2xl border border-zinc-800/60 shadow-lg flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h4 className="text-zinc-400 text-xs font-bold font-mono tracking-wider uppercase">
            Faceless / AI Automation <span className="text-emerald-500/80 text-[10px] font-mono font-normal">(&bull; SERP Analyzed)</span>
          </h4>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
            result.tier === 'HIGH'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
              : result.tier === 'MEDIUM'
              ? 'bg-blue-500/10 border border-blue-500/30 text-blue-300'
              : 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
          }`}>
            {result.tier} FEASIBILITY
          </span>
        </div>

        <div className="text-2xl font-black text-white mb-2">
          {result.badge}
        </div>

        <p className="text-xs text-zinc-300 leading-relaxed mb-4">
          {result.description}
        </p>

        <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs">
          <span className="text-[10px] font-mono text-zinc-500 uppercase block mb-1 font-bold">
            Recommended Workflow:
          </span>
          <span className="text-zinc-300 leading-normal block">
            {result.recommendedTools}
          </span>
        </div>
      </div>
    </div>
  );
}

interface AdvertiserSafetyCardProps {
  query: string;
  videos: VideoResult[];
}

export function AdvertiserSafetyCard({ query, videos }: AdvertiserSafetyCardProps) {
  const result = evaluateAdvertiserSafety(query, videos);

  return (
    <div className="bg-zinc-950/50 p-5 rounded-xl border border-zinc-800/40 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-zinc-500 text-[10px] font-bold font-mono tracking-wider uppercase block">
            Advertiser Safety Guard <span className="text-emerald-500/80 font-normal">(&bull; SERP Analyzed)</span>
          </span>
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
            result.status === 'SAFE'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
              : result.status === 'CAUTION'
              ? 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
          }`}>
            {result.status}
          </span>
        </div>

        <div className="text-xl font-black text-white mb-1">
          {result.badge}
        </div>

        <p className="text-[11px] text-zinc-400 leading-relaxed mt-2">
          {result.description}
        </p>
      </div>

      <div className="mt-4 pt-3 border-t border-zinc-800/60">
        <span className="text-[10px] font-mono text-zinc-500 uppercase block mb-1">
          YPP Policy Readout
        </span>
        <ul className="space-y-1">
          {result.warningNotes.map((note, idx) => (
            <li key={idx} className="text-[11px] text-zinc-400 flex items-start gap-1.5 leading-tight">
              <span className="text-zinc-500">•</span>
              <span>{note}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

interface FreshnessCardProps {
  videos: VideoItemForFreshness[];
}

export function FreshnessCard({ videos }: FreshnessCardProps) {
  const result = analyzeSerpFreshness(videos);

  return (
    <div className="bg-zinc-950/50 p-5 rounded-xl border border-zinc-800/40 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-zinc-500 text-[10px] font-bold font-mono tracking-wider uppercase block">
            SERP Freshness & Longevity <span className="text-emerald-500/80 font-normal">(&bull; SERP Analyzed)</span>
          </span>
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
            result.type === 'EVERGREEN'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
              : result.type === 'HIGH_VELOCITY'
              ? 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
              : 'bg-blue-500/10 border border-blue-500/30 text-blue-300'
          }`}>
            {result.type === 'EVERGREEN' ? 'Evergreen' : result.type === 'HIGH_VELOCITY' ? 'High Velocity' : 'Balanced'}
          </span>
        </div>

        <div className="text-xl font-black text-white mb-1">
          {result.badge}
        </div>

        <p className="text-[11px] text-zinc-400 leading-relaxed mt-2">
          {result.description}
        </p>
      </div>

      <div className="mt-4 pt-3 border-t border-zinc-800/60 flex justify-between items-center text-[10px] font-mono text-zinc-500">
        <span>Average Ranking Video Age:</span>
        <span className="text-white font-bold">{result.avgAgeDays} days</span>
      </div>
    </div>
  );
}

interface EngagementCardProps {
  query: string;
  channels: ChannelMetrics[];
}

export function EngagementCard({ query, channels }: EngagementCardProps) {
  const result = evaluateEngagementDensity(query, channels);

  return (
    <div className="bg-zinc-950/50 p-5 rounded-xl border border-zinc-800/40 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-zinc-500 text-[10px] font-bold font-mono tracking-wider uppercase block">
            Audience Engagement & Loyalty <span className="text-emerald-500/80 font-normal">(&bull; SERP Analyzed)</span>
          </span>
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
            result.tier === 'HIGH'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
              : result.tier === 'MEDIUM'
              ? 'bg-blue-500/10 border border-blue-500/30 text-blue-300'
              : 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
          }`}>
            {result.tier} LOYALTY
          </span>
        </div>

        <div className="text-xl font-black text-white mb-1">
          {result.badge}
        </div>

        <p className="text-[11px] text-zinc-400 leading-relaxed mt-2">
          {result.description}
        </p>
      </div>

      <div className="mt-4 pt-3 border-t border-zinc-800/60">
        <span className="text-[10px] font-mono text-zinc-500 uppercase block mb-1">
          Primary Monetization Path
        </span>
        <span className="text-[11px] text-zinc-300 leading-tight block">
          {result.monetizationPath}
        </span>
      </div>
    </div>
  );
}

interface BarrierEntryCardProps {
  query: string;
  videos: VideoResult[];
}

export function BarrierEntryCard({ query, videos }: BarrierEntryCardProps) {
  const result = evaluateBarrierToEntry(query, videos);

  return (
    <div className="bg-zinc-950/50 p-6 rounded-2xl border border-zinc-800/60 shadow-lg flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h4 className="text-zinc-400 text-xs font-bold font-mono tracking-wider uppercase">
            Barrier to Entry & Skill Floor <span className="text-emerald-500/80 text-[10px] font-mono font-normal">(&bull; SERP Analyzed)</span>
          </h4>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
            result.tier === 'LOW'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
              : result.tier === 'MEDIUM'
              ? 'bg-blue-500/10 border border-blue-500/30 text-blue-300'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
          }`}>
            {result.tier} BARRIER
          </span>
        </div>

        <div className="text-2xl font-black text-white mb-2">
          {result.badge}
        </div>

        <p className="text-xs text-zinc-300 leading-relaxed mb-4">
          {result.description}
        </p>

        <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs">
          <span className="text-[10px] font-mono text-zinc-500 uppercase block mb-1 font-bold">
            Estimated Setup Requirements:
          </span>
          <span className="text-zinc-300 leading-normal block">
            {result.setupCost}
          </span>
        </div>
      </div>
    </div>
  );
}

interface RevenueDiversityCardProps {
  query: string;
  videos: VideoResult[];
}

export function RevenueDiversityCard({ query, videos }: RevenueDiversityCardProps) {
  const result = calculateRevenueDiversity(query, videos);

  const channelsList = [
    { name: "Digital products", score: result.digitalScore, color: "bg-blue-500" },
    { name: "Gear affiliate", score: result.physicalScore, color: "bg-indigo-500" },
    { name: "Brand sponsors", score: result.sponsorScore, color: "bg-purple-500" },
  ];

  return (
    <div className="bg-zinc-950/50 p-5 rounded-xl border border-zinc-800/40 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-zinc-500 text-[10px] font-bold font-mono tracking-wider uppercase block">
            Monetization Diversity <span className="text-emerald-500/80 font-normal">(&bull; SERP Analyzed)</span>
          </span>
          <span className="px-2 py-0.5 rounded-md text-[10px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono font-bold">
            Score: {result.score}/100
          </span>
        </div>

        <div className="text-xl font-black text-white mb-1">
          {result.badge}
        </div>

        <p className="text-[11px] text-zinc-400 leading-relaxed mt-2 mb-4">
          {result.description}
        </p>
      </div>

      <div className="space-y-2 pt-3 border-t border-zinc-800/60">
        {channelsList.map((chan, idx) => (
          <div key={idx}>
            <div className="flex justify-between text-[10px] font-mono text-zinc-500 mb-0.5">
              <span>{chan.name}</span>
              <span className="text-zinc-300 font-bold">{chan.score}%</span>
            </div>
            <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
              <div
                className={`${chan.color} h-full transition-all`}
                style={{ width: `${chan.score}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface CopyrightRiskCardProps {
  query: string;
  videos: VideoResult[];
}

export function CopyrightRiskCard({ query, videos }: CopyrightRiskCardProps) {
  const result = evaluateCopyrightRisk(query, videos);

  return (
    <div className="bg-zinc-950/50 p-5 rounded-xl border border-zinc-800/40 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-zinc-500 text-[10px] font-bold font-mono tracking-wider uppercase block">
            Copyright & Claims Risk <span className="text-emerald-500/80 font-normal">(&bull; SERP Analyzed)</span>
          </span>
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
            result.status === 'SAFE'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
              : result.status === 'CAUTION'
              ? 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
          }`}>
            {result.status}
          </span>
        </div>

        <div className="text-xl font-black text-white mb-1">
          {result.badge}
        </div>

        <p className="text-[11px] text-zinc-400 leading-relaxed mt-2">
          {result.description}
        </p>
      </div>

      <div className="mt-4 pt-3 border-t border-zinc-800/60 flex justify-between items-center text-[10px] font-mono text-zinc-500">
        <span>Channel IP Safety Rating:</span>
        <span className={`font-bold ${
          result.status === 'SAFE' ? 'text-emerald-400' : result.status === 'CAUTION' ? 'text-amber-400' : 'text-rose-400'
        }`}>{result.score}/100</span>
      </div>
    </div>
  );
}

interface ThumbnailDensityCardProps {
  query: string;
}

export function ThumbnailDensityCard({ query }: ThumbnailDensityCardProps) {
  const result = evaluateThumbnailDensity(query);

  return (
    <div className="bg-zinc-950/50 p-6 rounded-2xl border border-zinc-800/60 shadow-lg flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h4 className="text-zinc-400 text-xs font-bold font-mono tracking-wider uppercase">
            Thumbnail Saturated Density <span className="text-amber-500/80 text-[10px] font-mono font-normal">(&bull; Keyword Estimate)</span>
          </h4>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
            result.type === 'AESTHETIC_OPPORTUNITY'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
              : result.type === 'BALANCED'
              ? 'bg-blue-500/10 border border-blue-500/30 text-blue-300'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
          }`}>
            {result.type === 'AESTHETIC_OPPORTUNITY' ? 'Clean Option' : result.type === 'BALANCED' ? 'Balanced' : 'Red Ocean'}
          </span>
        </div>

        <div className="text-2xl font-black text-white mb-2">
          {result.badge}
        </div>

        <p className="text-xs text-zinc-300 leading-relaxed mb-4">
          {result.description}
        </p>
      </div>

      <div className="mt-4 pt-3 border-t border-zinc-800/60 flex justify-between items-center text-[10px] font-mono text-zinc-500">
        <span>Click-Through-Rate Saturation:</span>
        <span className="text-white font-bold">{100 - result.score}% Saturation</span>
      </div>
    </div>
  );
}
