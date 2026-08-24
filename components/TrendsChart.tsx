"use client";

import { useState } from "react";
import { TrendsRawData, TrendLifecycleInfo, TrendsDataPoint } from "@/lib/trends";

interface TrendsChartProps {
  trends: TrendsRawData;
  simplifiedQuery: string;
}

type TimeframeType = '3m' | '6m' | '12m' | '24m' | 'all';

export function TrendsChart({ trends, simplifiedQuery }: TrendsChartProps) {
  const [timeframe, setTimeframe] = useState<TimeframeType>('12m');
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    value: number;
    date: string;
    index: number;
  } | null>(null);

  const pointsToPlot = (() => {
    if (timeframe === '3m') return trends.points.slice(-3);
    if (timeframe === '6m') return trends.points.slice(-6);
    if (timeframe === '12m') return trends.points.slice(-12);
    if (timeframe === '24m') return trends.points.slice(-24);
    return trends.points;
  })();

  if (pointsToPlot.length === 0) {
    return (
      <div className="bg-zinc-900/35 border border-zinc-800/60 backdrop-blur-xl rounded-2xl p-6 sm:p-8 shadow-lg">
        <div className="h-40 flex items-center justify-center text-zinc-500 text-xs border border-dashed border-zinc-800 rounded-xl">
          No historical points to plot.
        </div>
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

  let pathD = "";
  pointsToPlot.forEach((p, i) => {
    const x = getX(i);
    const y = getY(p.value);
    if (i === 0) pathD += `M ${x} ${y}`;
    else pathD += ` L ${x} ${y}`;
  });

  let areaD = pathD;
  if (pointsToPlot.length > 0) {
    const firstX = getX(0);
    const lastX = getX(pointsToPlot.length - 1);
    const bottomY = padTop + chartHeight;
    areaD += ` L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }

  return (
    <div className="bg-zinc-900/35 border border-zinc-800/60 backdrop-blur-xl rounded-2xl p-6 sm:p-8 shadow-lg">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="text-zinc-400 text-xs font-bold font-mono tracking-wider uppercase">
              Search Interest Over Time
            </h3>
            {trends.lifecycle && (
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                trends.lifecycle.color === 'emerald'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : trends.lifecycle.color === 'amber'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  : trends.lifecycle.color === 'rose'
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
              }`}>
                {trends.lifecycle.badge}
              </span>
            )}
          </div>
          <span className="text-[10px] text-zinc-500 font-mono block">
            {trends.lifecycle?.description || `Google Trends signal for "${simplifiedQuery}"`}
          </span>
        </div>
        {/* Timeframe Toggle */}
        <div className="flex flex-wrap bg-zinc-950/60 border border-zinc-800 rounded-xl p-1 shrink-0 self-start sm:self-auto gap-0.5">
          {[
            { id: '3m', label: '3 Mo' },
            { id: '6m', label: '6 Mo' },
            { id: '12m', label: '12 Mo' },
            { id: '24m', label: '24 Mo' },
            { id: 'all', label: `All (${trends.points.length}m)` },
          ].map((tf) => (
            <button
              key={tf.id}
              onClick={() => {
                setTimeframe(tf.id as TimeframeType);
                setHoveredPoint(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                timeframe === tf.id
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Chart Container */}
      <div className="relative">
        <svg 
          className="w-full h-auto" 
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          role="img"
          aria-label={`Google Trends search interest chart for "${simplifiedQuery}"`}
        >
          <defs>
            <linearGradient id="chartStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="50%" stopColor="#4f46e5" />
              <stop offset="100%" stopColor="#6366f1" />
            </linearGradient>
            <linearGradient id="chartArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {[0, 25, 50, 75, 100].map((v) => {
            const y = getY(v);
            return (
              <g key={v} className="opacity-[0.06] dark:opacity-[0.08]" aria-hidden="true">
                <line x1={padLeft} y1={y} x2={svgWidth - padRight} y2={y} stroke="currentColor" strokeWidth="1" />
                <text x={padLeft - 8} y={y + 4} textAnchor="end" className="fill-current text-[10px] font-mono font-bold">{v}</text>
              </g>
            );
          })}

          {pointsToPlot.length > 1 && (
            <g className="opacity-40 text-[9px] font-mono font-medium fill-zinc-400" aria-hidden="true">
              <text x={getX(0)} y={svgHeight - 10} textAnchor="start">{pointsToPlot[0].formattedTime}</text>
              <text x={getX(Math.floor(pointsToPlot.length / 2))} y={svgHeight - 10} textAnchor="middle">{pointsToPlot[Math.floor(pointsToPlot.length / 2)].formattedTime}</text>
              <text x={getX(pointsToPlot.length - 1)} y={svgHeight - 10} textAnchor="end">{pointsToPlot[pointsToPlot.length - 1].formattedTime}</text>
            </g>
          )}

          <path d={areaD} fill="url(#chartArea)" pointerEvents="none" aria-hidden="true" />
          <path d={pathD} fill="none" stroke="url(#chartStroke)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" aria-hidden="true" />

          {pointsToPlot.map((p, i) => {
            const x = getX(i);
            const colWidth = chartWidth / pointsToPlot.length;
            const focusOrEnter = () => {
              setHoveredPoint({ x, y: getY(p.value), value: p.value, date: p.formattedTime, index: i });
            };
            return (
              <rect
                key={i}
                x={x - colWidth / 2}
                y={padTop}
                width={colWidth}
                height={chartHeight}
                fill="transparent"
                className="cursor-crosshair focus:outline-none focus:fill-blue-500/5"
                role="button"
                aria-label={`Point ${i + 1}: ${p.formattedTime}, interest ${p.value}`}
                tabIndex={0}
                onMouseEnter={focusOrEnter}
                onFocus={focusOrEnter}
                onMouseLeave={() => setHoveredPoint(null)}
                onBlur={() => setHoveredPoint(null)}
              />
            );
          })}

          {hoveredPoint && (
            <g aria-hidden="true">
              <line x1={hoveredPoint.x} y1={padTop} x2={hoveredPoint.x} y2={padTop + chartHeight} stroke="#6366f1" strokeWidth="1.2" strokeDasharray="4 4" pointerEvents="none" className="opacity-60" />
              <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r="5" fill="#4f46e5" stroke="#fff" strokeWidth="2" pointerEvents="none" />
            </g>
          )}
        </svg>

        {hoveredPoint && (
          <div
            className={`absolute bg-zinc-950/95 border border-zinc-800 rounded-lg px-3 py-2 shadow-xl pointer-events-none -translate-y-full -mt-3.5 transition-all duration-75 text-[11px] leading-tight ${
              hoveredPoint.index === 0
                ? 'left-0 translate-x-0'
                : hoveredPoint.index === pointsToPlot.length - 1
                ? 'right-0 translate-x-0'
                : 'left-1/2 -translate-x-1/2'
            }`}
            style={{
              left: hoveredPoint.index === 0 || hoveredPoint.index === pointsToPlot.length - 1
                ? undefined
                : `${(hoveredPoint.x / svgWidth) * 100}%`,
              top: `${(hoveredPoint.y / svgHeight) * 100}%`
            }}
          >
            <span className="text-zinc-500 font-bold block mb-1">{hoveredPoint.date}</span>
            <span className="text-white font-extrabold text-sm block">Interest: {hoveredPoint.value}</span>
          </div>
        )}
      </div>
    </div>
  );
}
