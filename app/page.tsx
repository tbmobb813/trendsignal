"use client";

import { useState } from "react";

interface ChannelMetrics {
  channelId: string;
  title: string;
  subscriberCount: number | null;
  videoCount: number;
  viewCount: number;
  viewsPerVideo: number;
  viewsPerSubscriber: number | null;
  isThin: boolean;
  isViralOutlier: boolean;
  isGeneralistSuspected: boolean;
  crossQueryAppearances: number;
}

interface CompetitionScoreResult {
  query: string;
  channels: ChannelMetrics[];
  rawCompetitorCount: number;
  meaningfulCompetitorCount: number;
  specialistCompetitorCount: number;
  generalistDipInGap: number;
  medianVideoCount: number;
  authorityPressure: number;
  concentrationPressure: number;
  generalistAuthorityShare: number;
  score: number;
  notes: string[];
}

interface VideoResult {
  videoId: string;
  title: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
}

interface TrendsDataPoint {
  time: string;
  formattedTime: string;
  value: number;
  hasData: boolean;
}

interface TrendsRawData {
  query: string;
  fetchedAt: string;
  points: TrendsDataPoint[];
  recentDataCoverage: number;
}

interface SearchResponse {
  source: 'cache' | 'live';
  fetchedAt: string;
  simplifiedQuery: string;
  scoreResult: CompetitionScoreResult;
  videos: VideoResult[];
  trends: TrendsRawData | null;
  trendsWarning?: string;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [timeframe, setTimeframe] = useState<'recent' | 'all'>('recent');
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; value: number; date: string; index: number } | null>(null);

  const samples = [
    "budget meal prep",
    "japanese chisel sharpening",
    "morning routine",
    "pottery for beginners",
    "restoring vintage mechanical calculators"
  ];

  async function handleSearch(searchQuery: string) {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setError("Please enter at least 2 characters.");
      return;
    }

    setLoading(true);
    setError(null);
    setHoveredPoint(null);
    setTimeframe('recent');
    try {
      const res = await fetch(`/api/niche?q=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || `Search failed with status ${res.status}`);
      }
      const json: SearchResponse = await res.json();
      setData(json);
      setQuery(searchQuery); // Sync query with selected search query
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  const formatNumber = (num: number | null) => {
    if (num === null) return "Hidden";
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toString();
  };

  const getScoreColorClass = (score: number) => {
    if (score >= 70) return "text-emerald-400 stroke-emerald-500 border-emerald-500/20 bg-emerald-500/5";
    if (score >= 40) return "text-amber-400 stroke-amber-500 border-amber-500/20 bg-amber-500/5";
    return "text-rose-400 stroke-rose-500 border-rose-500/20 bg-rose-500/5";
  };

  const getScoreBadgeColorClass = (score: number) => {
    if (score >= 70) return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
    if (score >= 40) return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
    return "bg-rose-500/10 text-rose-400 border border-rose-500/20";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 70) return "High Opportunity";
    if (score >= 40) return "Moderate Opportunity";
    return "Low Opportunity / Dense Field";
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-zinc-100 font-sans selection:bg-blue-600/30 selection:text-white">
      {/* Background Glow */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[100px] pointer-events-none -z-10" />

      {/* Navigation Header */}
      <header className="border-b border-zinc-800/40 bg-zinc-950/20 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-lg shadow-blue-500/20">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                TrendSignal
              </span>
              <span className="text-[10px] text-zinc-500 block font-mono -mt-1 tracking-wider uppercase">v2 Opportunity Scorer</span>
            </div>
          </div>
          <div className="text-xs text-zinc-500 font-mono">
            {data && (
              <span className="flex items-center gap-1.5 bg-zinc-900/60 px-3 py-1.5 rounded-full border border-zinc-800/60">
                <span className={`w-1.5 h-1.5 rounded-full ${data.source === 'cache' ? 'bg-indigo-400' : 'bg-emerald-400'}`} />
                {data.source === 'cache' ? 'CACHED' : 'LIVE API'} &bull; {new Date(data.fetchedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Search Header Hero */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-b from-white via-zinc-100 to-zinc-400 bg-clip-text text-transparent mb-4">
            Find Your Next YouTube Niche
          </h1>
          <p className="text-zinc-400 text-base leading-relaxed">
            Scan competition authority, channel concentration, and Google Trends search coverage to identify open market gaps before you create content.
          </p>
        </div>

        {/* Input & Search Section */}
        <div className="max-w-3xl mx-auto bg-zinc-900/35 border border-zinc-800/60 backdrop-blur-xl rounded-2xl p-6 sm:p-8 shadow-xl shadow-black/30 mb-12">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Enter a descriptive niche topic (e.g. budget meal prep)"
                className="w-full pl-12 pr-4 py-4 rounded-xl bg-zinc-950/70 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all text-sm"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch(query)}
              />
            </div>
            <button
              onClick={() => handleSearch(query)}
              disabled={loading}
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-500 text-white font-medium rounded-xl transition-all shadow-lg shadow-blue-600/10 active:scale-[0.98] text-sm shrink-0 flex items-center justify-center min-w-[120px]"
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                "Scan Niche"
              )}
            </button>
          </div>

          {error && (
            <div className="mt-4 flex items-center gap-2.5 px-4 py-3 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {error}
            </div>
          )}

          {/* Quick suggestions */}
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="text-zinc-500 text-xs font-medium">Examples:</span>
            {samples.map((s, i) => (
              <button
                key={i}
                onClick={() => {
                  setQuery(s);
                  handleSearch(s);
                }}
                disabled={loading}
                className="px-3 py-1.5 rounded-full bg-zinc-950/40 hover:bg-zinc-800/80 border border-zinc-800 text-[11px] text-zinc-400 hover:text-zinc-200 transition-all"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Dashboard Results (Shown when data is populated) */}
        {data && (
          <div className="space-y-8 animate-fade-in">
            {/* Top Cards: Score and Query Insights */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Radial Score Gauge */}
              <div className="bg-zinc-900/35 border border-zinc-800/60 backdrop-blur-xl rounded-2xl p-8 flex flex-col items-center justify-center text-center shadow-lg relative overflow-hidden">
                <div className="absolute inset-0 bg-radial-gradient from-blue-500/5 to-transparent pointer-events-none" />
                <h3 className="text-zinc-400 text-xs font-bold font-mono tracking-wider uppercase mb-6">
                  Opportunity Score
                </h3>
                <div className="relative w-40 h-40 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    {/* Background circle */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      className="stroke-zinc-800/70"
                      strokeWidth="8"
                      fill="transparent"
                    />
                    {/* Foreground circle with stroke-dashoffset */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      className={`${getScoreColorClass(data.scoreResult.score).split(" ")[1]} transition-all duration-1000 ease-out`}
                      strokeWidth="8"
                      strokeDasharray={251.2}
                      strokeDashoffset={251.2 - (251.2 * data.scoreResult.score) / 100}
                      strokeLinecap="round"
                      fill="transparent"
                    />
                  </svg>
                  {/* Inside Text */}
                  <div className="absolute text-center">
                    <span className="text-5xl font-black tracking-tight text-white">
                      {data.scoreResult.score}
                    </span>
                    <span className="text-zinc-500 block text-[10px] font-bold tracking-wider uppercase mt-1">
                      out of 100
                    </span>
                  </div>
                </div>

                <div className="mt-6">
                  <span className={`px-3.5 py-1.5 rounded-full text-xs font-bold ${getScoreBadgeColorClass(data.scoreResult.score)}`}>
                    {getScoreLabel(data.scoreResult.score)}
                  </span>
                </div>
              </div>

              {/* Takeaway and Simplified Search */}
              <div className="lg:col-span-2 bg-zinc-900/35 border border-zinc-800/60 backdrop-blur-xl rounded-2xl p-8 flex flex-col justify-between shadow-lg">
                <div>
                  <h3 className="text-zinc-400 text-xs font-bold font-mono tracking-wider uppercase mb-3">
                    Niche Summary
                  </h3>
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-4">
                    <span className="text-2xl font-extrabold text-white">
                      &ldquo;{data.scoreResult.query}&rdquo;
                    </span>
                  </div>

                  <div className="space-y-3.5 text-zinc-300 text-sm leading-relaxed">
                    <p>
                      Analyzing <span className="text-white font-semibold">{data.scoreResult.rawCompetitorCount}</span> ranking video channels. Excluding small/thin channels, there are <span className="text-white font-semibold">{data.scoreResult.meaningfulCompetitorCount}</span> meaningful competitors in the field, of which <span className="text-white font-semibold">{data.scoreResult.specialistCompetitorCount}</span> act as focused niche specialists.
                    </p>
                    {data.simplifiedQuery !== data.scoreResult.query.toLowerCase() && (
                      <div className="inline-flex items-center gap-2 bg-blue-500/5 border border-blue-500/10 px-3.5 py-2 rounded-xl text-xs text-blue-300 mt-1">
                        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>
                          <strong>Trends Query Simplified:</strong> &ldquo;{data.simplifiedQuery}&rdquo; was searched on Google Trends to ensure high interest coverage match.
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-6 border-t border-zinc-800/50 mt-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="bg-zinc-950/40 p-3.5 rounded-xl border border-zinc-800/40 text-center">
                    <span className="text-[10px] text-zinc-500 block font-bold tracking-wider uppercase mb-1">Raw Competitors</span>
                    <span className="text-lg font-bold text-white">{data.scoreResult.rawCompetitorCount}</span>
                  </div>
                  <div className="bg-zinc-950/40 p-3.5 rounded-xl border border-zinc-800/40 text-center">
                    <span className="text-[10px] text-zinc-500 block font-bold tracking-wider uppercase mb-1">Niche Specialists</span>
                    <span className="text-lg font-bold text-white">{data.scoreResult.specialistCompetitorCount}</span>
                  </div>
                  <div className="bg-zinc-950/40 p-3.5 rounded-xl border border-zinc-800/40 text-center col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-zinc-500 block font-bold tracking-wider uppercase mb-1">Median Videos</span>
                    <span className="text-lg font-bold text-white">{data.scoreResult.medianVideoCount} <span className="text-[10px] text-zinc-500 font-normal">/ ch</span></span>
                  </div>
                </div>
              </div>
            </div>

            {/* Warnings and Notes Section */}
            {data.scoreResult.notes.length > 0 && (
              <div className="bg-zinc-900/35 border border-zinc-800/60 backdrop-blur-xl rounded-2xl p-6 sm:p-8 shadow-lg">
                <h3 className="text-zinc-400 text-xs font-bold font-mono tracking-wider uppercase mb-4">
                  System Findings & Alerts
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data.scoreResult.notes.map((note, index) => {
                    const isAlert = note.includes("Google Trends shows almost no") || note.includes("Generalists hold") || note.includes("concentrated");
                    const isWarning = note.includes("inconsistent search interest") || note.includes("No Trends data available") || note.includes("No historical query");

                    return (
                      <div
                        key={index}
                        className={`flex gap-3 px-4 py-3.5 rounded-xl text-xs border leading-relaxed ${
                          isAlert
                            ? "bg-rose-500/5 border-rose-500/10 text-rose-300"
                            : isWarning
                            ? "bg-amber-500/5 border-amber-500/10 text-amber-300"
                            : "bg-zinc-950/40 border-zinc-800 text-zinc-300"
                        }`}
                      >
                        <svg className="w-4.5 h-4.5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span>{note}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Google Trends Search Interest over time chart */}
            {data.trends && data.trends.points.length > 0 && (
              <div className="bg-zinc-900/35 border border-zinc-800/60 backdrop-blur-xl rounded-2xl p-6 sm:p-8 shadow-lg">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
                  <div>
                    <h3 className="text-zinc-400 text-xs font-bold font-mono tracking-wider uppercase block">
                      Search Interest Over Time
                    </h3>
                    <span className="text-[10px] text-zinc-500 font-mono mt-1 block">
                      Google Trends signal for &ldquo;{data.simplifiedQuery}&rdquo;
                    </span>
                  </div>
                  {/* Timeframe Toggle */}
                  <div className="flex bg-zinc-950/60 border border-zinc-800 rounded-xl p-1 shrink-0 self-start sm:self-auto">
                    <button
                      onClick={() => { setTimeframe('recent'); setHoveredPoint(null); }}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        timeframe === 'recent'
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Last 24 Months
                    </button>
                    <button
                      onClick={() => { setTimeframe('all'); setHoveredPoint(null); }}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        timeframe === 'all'
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      All Time ({data.trends.points.length} mo)
                    </button>
                  </div>
                </div>

                {/* SVG Chart Container */}
                {(() => {
                  const pointsToPlot = timeframe === 'recent' ? data.trends.points.slice(-24) : data.trends.points;
                  if (pointsToPlot.length === 0) {
                    return (
                      <div className="h-40 flex items-center justify-center text-zinc-500 text-xs border border-dashed border-zinc-800 rounded-xl">
                        No historical points to plot.
                      </div>
                    );
                  }

                  const svgWidth = 800;
                  const svgHeight = 200;
                  const padLeft = 40;
                  const padRight = 20;
                  const padTop = 20;
                  const padBottom = 30;

                  const chartWidth = svgWidth - padLeft - padRight;
                  const chartHeight = svgHeight - padTop - padBottom;

                  const getX = (index: number) => {
                    if (pointsToPlot.length <= 1) return padLeft;
                    return padLeft + (index / (pointsToPlot.length - 1)) * chartWidth;
                  };

                  const getY = (val: number) => {
                    return padTop + chartHeight - (val / 100) * chartHeight;
                  };

                  // Build line path
                  let pathD = "";
                  pointsToPlot.forEach((p, i) => {
                    const x = getX(i);
                    const y = getY(p.value);
                    if (i === 0) {
                      pathD += `M ${x} ${y}`;
                    } else {
                      pathD += ` L ${x} ${y}`;
                    }
                  });

                  // Build area path
                  let areaD = pathD;
                  if (pointsToPlot.length > 0) {
                    const firstX = getX(0);
                    const lastX = getX(pointsToPlot.length - 1);
                    const bottomY = padTop + chartHeight;
                    areaD += ` L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
                  }

                  return (
                    <div className="relative">
                      {/* Gradient Definitions */}
                      <svg className="w-full h-auto" viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
                        <defs>
                          {/* Stroke gradient */}
                          <linearGradient id="chartStroke" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#3b82f6" />
                            <stop offset="50%" stopColor="#4f46e5" />
                            <stop offset="100%" stopColor="#6366f1" />
                          </linearGradient>
                          {/* Area gradient */}
                          <linearGradient id="chartArea" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.15" />
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>

                        {/* Y-axis helper gridlines (0, 25, 50, 75, 100) */}
                        {[0, 25, 50, 75, 100].map((v) => {
                          const y = getY(v);
                          return (
                            <g key={v} className="opacity-[0.06] dark:opacity-[0.08]">
                              <line
                                x1={padLeft}
                                y1={y}
                                x2={svgWidth - padRight}
                                y2={y}
                                stroke="currentColor"
                                strokeWidth="1"
                              />
                              <text
                                x={padLeft - 8}
                                y={y + 4}
                                textAnchor="end"
                                className="fill-current text-[10px] font-mono font-bold"
                              >
                                {v}
                              </text>
                            </g>
                          );
                        })}

                        {/* X-axis labels (start, mid, end) */}
                        {pointsToPlot.length > 1 && (
                          <g className="opacity-40 text-[9px] font-mono font-medium fill-zinc-400">
                            {/* Start label */}
                            <text x={getX(0)} y={svgHeight - 10} textAnchor="start">
                              {pointsToPlot[0].formattedTime}
                            </text>
                            {/* Mid label */}
                            <text x={getX(Math.floor(pointsToPlot.length / 2))} y={svgHeight - 10} textAnchor="middle">
                              {pointsToPlot[Math.floor(pointsToPlot.length / 2)].formattedTime}
                            </text>
                            {/* End label */}
                            <text x={getX(pointsToPlot.length - 1)} y={svgHeight - 10} textAnchor="end">
                              {pointsToPlot[pointsToPlot.length - 1].formattedTime}
                            </text>
                          </g>
                        )}

                        {/* Render Area Fill */}
                        <path d={areaD} fill="url(#chartArea)" pointerEvents="none" />

                        {/* Render Line Stroke */}
                        <path
                          d={pathD}
                          fill="none"
                          stroke="url(#chartStroke)"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          pointerEvents="none"
                        />

                        {/* Interactive vertical hover stripes */}
                        {pointsToPlot.map((p, i) => {
                          const x = getX(i);
                          const colWidth = chartWidth / pointsToPlot.length;
                          return (
                            <rect
                              key={i}
                              x={x - colWidth / 2}
                              y={padTop}
                              width={colWidth}
                              height={chartHeight}
                              fill="transparent"
                              className="cursor-crosshair"
                              onMouseEnter={() => {
                                setHoveredPoint({
                                  x,
                                  y: getY(p.value),
                                  value: p.value,
                                  date: p.formattedTime,
                                  index: i
                                });
                              }}
                              onMouseLeave={() => setHoveredPoint(null)}
                            />
                          );
                        })}

                        {/* Hover elements (only when hovering) */}
                        {hoveredPoint && (
                          <>
                            {/* Vertical tracker line */}
                            <line
                              x1={hoveredPoint.x}
                              y1={padTop}
                              x2={hoveredPoint.x}
                              y2={padTop + chartHeight}
                              stroke="#6366f1"
                              strokeWidth="1.2"
                              strokeDasharray="4 4"
                              pointerEvents="none"
                              className="opacity-60"
                            />
                            {/* Guide circle on line */}
                            <circle
                              cx={hoveredPoint.x}
                              cy={hoveredPoint.y}
                              r="5"
                              fill="#4f46e5"
                              stroke="#fff"
                              strokeWidth="2"
                              pointerEvents="none"
                            />
                          </>
                        )}
                      </svg>

                      {/* Tooltip Overlay */}
                      {hoveredPoint && (
                        <div
                          className="absolute bg-zinc-950/95 border border-zinc-800 rounded-lg px-3 py-2 shadow-xl pointer-events-none -translate-x-1/2 -translate-y-full -mt-3.5 transition-all duration-75 text-[11px] leading-tight"
                          style={{
                            left: `${(hoveredPoint.x / svgWidth) * 100}%`,
                            top: `${(hoveredPoint.y / svgHeight) * 100}%`
                          }}
                        >
                          <span className="text-zinc-500 font-bold block mb-1">{hoveredPoint.date}</span>
                          <span className="text-white font-extrabold text-sm block">Interest: {hoveredPoint.value}</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Metrics Breakdown (Pressures Grid) */}
            <div className="bg-zinc-900/35 border border-zinc-800/60 backdrop-blur-xl rounded-2xl p-8 shadow-lg">
              <h3 className="text-zinc-400 text-xs font-bold font-mono tracking-wider uppercase mb-6">
                Metric Pressures Breakdown
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                      Percentage of the trailing 24 months with meaningful Google Search interest signal.
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
                      Median competitor size. High percentage means the SERP is filled with massive, established channels.
                    </p>
                  </div>
                  <div className="mt-4">
                    <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-amber-500 h-full rounded-full"
                        style={{ width: `${data.scoreResult.authorityPressure * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Concentration Pressure */}
                <div className="bg-zinc-950/50 p-5 rounded-xl border border-zinc-800/40 flex flex-col justify-between">
                  <div>
                    <span className="text-zinc-500 text-[10px] font-bold font-mono tracking-wider uppercase block mb-1">
                      Concentration Pressure
                    </span>
                    <span className="text-2xl font-black text-white">
                      {Math.round(data.scoreResult.concentrationPressure * 100)}%
                    </span>
                    <p className="text-[11px] text-zinc-400 leading-relaxed mt-2.5">
                      SERP monopolization (HHI index). High concentration indicates a few channels dominate multiple ranking spots.
                    </p>
                  </div>
                  <div className="mt-4">
                    <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-500 h-full rounded-full"
                        style={{ width: `${data.scoreResult.concentrationPressure * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* 4. Generalist Authority Share */}
                <div className="bg-zinc-950/50 p-5 rounded-xl border border-zinc-800/40 flex flex-col justify-between">
                  <div>
                    <span className="text-zinc-500 text-[10px] font-bold font-mono tracking-wider uppercase block mb-1">
                      Generalist Authority Share
                    </span>
                    <span className="text-2xl font-black text-white">
                      {Math.round(data.scoreResult.generalistAuthorityShare * 100)}%
                    </span>
                    <p className="text-[11px] text-zinc-400 leading-relaxed mt-2.5">
                      Percentage of the competitor subscriber pool owned by massive generalist channels dipping into this niche.
                    </p>
                  </div>
                  <div className="mt-4">
                    <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-purple-500 h-full rounded-full"
                        style={{ width: `${data.scoreResult.generalistAuthorityShare * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Competitors List */}
            <div className="bg-zinc-900/35 border border-zinc-800/60 backdrop-blur-xl rounded-2xl p-6 sm:p-8 shadow-lg">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
                <div>
                  <h3 className="text-zinc-400 text-xs font-bold font-mono tracking-wider uppercase block">
                    Competitors Analysis
                  </h3>
                  <span className="text-[10px] text-zinc-500 font-mono mt-1 block">Sorted by Subscriber Count</span>
                </div>
              </div>

              <div className="overflow-x-auto -mx-6 sm:mx-0">
                <table className="w-full min-w-[700px] text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                      <th className="pb-4 px-6">Channel</th>
                      <th className="pb-4 px-4 text-right">Subscribers</th>
                      <th className="pb-4 px-4 text-right">Videos</th>
                      <th className="pb-4 px-4 text-right">Views / Video</th>
                      <th className="pb-4 px-6 text-center">Flags / Tags</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/40 text-zinc-300">
                    {data.scoreResult.channels
                      .sort((a, b) => (b.subscriberCount || 0) - (a.subscriberCount || 0))
                      .map((channel, i) => (
                        <tr key={i} className="hover:bg-zinc-800/10 transition-colors">
                          <td className="py-4 px-6 font-semibold text-white">
                            <a
                              href={`https://www.youtube.com/channel/${channel.channelId}`}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:text-blue-400 flex items-center gap-1"
                            >
                              {channel.title}
                              <svg className="w-3.5 h-3.5 opacity-40 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          </td>
                          <td className="py-4 px-4 text-right font-mono font-semibold text-zinc-200">
                            {formatNumber(channel.subscriberCount)}
                          </td>
                          <td className="py-4 px-4 text-right font-mono">
                            {channel.videoCount}
                          </td>
                          <td className="py-4 px-4 text-right font-mono text-zinc-400">
                            {formatNumber(Math.round(channel.viewsPerVideo))}
                          </td>
                          <td className="py-4 px-6 text-center">
                            <div className="flex justify-center flex-wrap gap-1.5">
                              {channel.isGeneralistSuspected && (
                                <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[9px] px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
                                  Generalist
                                </span>
                              )}
                              {channel.isViralOutlier && (
                                <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[9px] px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
                                  Viral Outlier
                                </span>
                              )}
                              {channel.isThin && (
                                <span className="bg-zinc-800 text-zinc-500 text-[9px] px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
                                  Thin
                                </span>
                              )}
                              {!channel.isGeneralistSuspected && !channel.isThin && (
                                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
                                  Specialist
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Video Search Results (SERP) */}
            <div className="bg-zinc-900/35 border border-zinc-800/60 backdrop-blur-xl rounded-2xl p-6 sm:p-8 shadow-lg">
              <h3 className="text-zinc-400 text-xs font-bold font-mono tracking-wider uppercase mb-6">
                Top Video Search Results
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.videos.map((vid, i) => (
                  <a
                    key={i}
                    href={`https://www.youtube.com/watch?v=${vid.videoId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="group bg-zinc-950/40 border border-zinc-800/60 rounded-xl p-4 hover:border-zinc-700/80 hover:bg-zinc-800/10 transition-all flex gap-4"
                  >
                    <div className="w-10 h-10 rounded-lg bg-zinc-900 flex items-center justify-center shrink-0 border border-zinc-800 group-hover:bg-blue-500/10 group-hover:border-blue-500/25 transition-all text-zinc-500 group-hover:text-blue-400">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-bold text-zinc-500 font-mono block mb-1">
                        Rank #{i + 1}
                      </span>
                      <h4 className="text-white text-xs font-semibold leading-snug truncate group-hover:text-blue-400 transition-colors">
                        {vid.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-1.5 text-[11px] text-zinc-400">
                        <span className="font-medium truncate max-w-[150px]">{vid.channelTitle}</span>
                        <span>&bull;</span>
                        <span>{new Date(vid.publishedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Simple Footer */}
      <footer className="border-t border-zinc-800/40 py-8 text-center text-xs text-zinc-600 bg-zinc-950/20 backdrop-blur-md mt-16 font-mono">
        <p>&copy; {new Date().getFullYear()} TrendSignal. Built for YouTube Niche Opportunity Scouring.</p>
      </footer>
    </div>
  );
}
