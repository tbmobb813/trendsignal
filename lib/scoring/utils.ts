/**
 * Central utility file containing UI color class mappings and label functions.
 */

export function getScoreLabel(score: number): string {
  if (score >= 75) return "High Opportunity";
  if (score >= 50) return "Moderate Opportunity";
  if (score >= 30) return "Low Opportunity";
  return "Saturated / Restricted";
}

export function getScoreColorClass(score: number): string {
  if (score >= 75) return "text-emerald-400 stroke-emerald-400";
  if (score >= 50) return "text-blue-400 stroke-blue-400";
  if (score >= 30) return "text-amber-400 stroke-amber-400";
  return "text-rose-400 stroke-rose-400";
}

export function getScoreBadgeColorClass(score: number): string {
  if (score >= 75) return "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300";
  if (score >= 50) return "bg-blue-500/10 border border-blue-500/30 text-blue-300";
  if (score >= 30) return "bg-amber-500/10 border border-amber-500/30 text-amber-300";
  return "bg-rose-500/10 border border-rose-500/30 text-rose-300";
}
