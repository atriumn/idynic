"use client";

import { CheckCircle, WarningCircle, Info } from "@phosphor-icons/react";
import { Progress } from "@/components/ui/progress";

interface MatchScoreVisualizerProps {
  overallScore: number;
  mustHaveScore: number;
  niceToHaveScore: number;
  matchDetails?: {
    mustHave: { matched: number; total: number };
    niceToHave: { matched: number; total: number };
  };
}

export function MatchScoreVisualizer({
  overallScore,
  mustHaveScore,
  niceToHaveScore,
  matchDetails = {
    mustHave: { matched: 0, total: 0 },
    niceToHave: { matched: 0, total: 0 },
  },
}: MatchScoreVisualizerProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 dark:text-green-400";
    if (score >= 50) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  const getMatchLabel = (score: number) => {
    if (score >= 90) return "Exceptional Match";
    if (score >= 80) return "Strong Alignment";
    if (score >= 60) return "Good Alignment";
    if (score >= 40) return "Developing Match";
    return "Low Alignment";
  };

  // Radial progress constants
  const size = 120;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (overallScore / 100) * circumference;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col items-center text-center">
        <div className="relative inline-flex items-center justify-center mb-4 group">
          <svg width={size} height={size} className="transform -rotate-90">
            {/* Background circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="currentColor"
              strokeWidth={strokeWidth}
              fill="transparent"
              className="text-muted/20"
            />
            {/* Progress circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="currentColor"
              strokeWidth={strokeWidth}
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className={`${getScoreColor(overallScore)} transition-all duration-1000 ease-out`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className={`text-3xl font-bold tracking-tight ${getScoreColor(overallScore)}`}
            >
              {overallScore}%
            </span>
          </div>
        </div>

        <div className="space-y-1">
          <h4 className="text-lg font-semibold tracking-tight">
            {getMatchLabel(overallScore)}
          </h4>
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">
            Identity Synthesis Score
          </p>
        </div>
      </div>

      <div className="space-y-5 pt-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 font-medium text-muted-foreground">
              <CheckCircle weight="fill" className="h-4 w-4 text-green-500" />
              REQUIRED QUALIFICATIONS
            </div>
            <span className="font-bold">{mustHaveScore}%</span>
          </div>
          <Progress value={mustHaveScore} className="h-1.5" />
          {matchDetails.mustHave.total > 0 && (
            <p className="text-[10px] text-muted-foreground/70 text-right">
              {matchDetails.mustHave.matched} OF {matchDetails.mustHave.total}{" "}
              CRITERIA MET
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 font-medium text-muted-foreground">
              <WarningCircle weight="fill" className="h-4 w-4 text-amber-500" />
              NICE-TO-HAVE SKILLS
            </div>
            <span className="font-bold">{niceToHaveScore}%</span>
          </div>
          <Progress value={niceToHaveScore} className="h-1.5" />
          {matchDetails.niceToHave.total > 0 && (
            <p className="text-[10px] text-muted-foreground/70 text-right">
              {matchDetails.niceToHave.matched} OF{" "}
              {matchDetails.niceToHave.total} CRITERIA MET
            </p>
          )}
        </div>
      </div>

      <div className="bg-primary/5 rounded-xl p-3 border border-primary/10 flex gap-3 items-start">
        <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          This score represents how well your documented claims and story
          evidence align with the role&apos;s specific requirements.
        </p>
      </div>
    </div>
  );
}
