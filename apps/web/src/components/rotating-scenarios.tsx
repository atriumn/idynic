"use client";

import { useState, useEffect } from "react";
import { Clock, Briefcase, TrendUp, Microphone, PencilLine } from "@phosphor-icons/react";

const scenarios = [
  {
    icon: Clock,
    moment: "It's 9pm. Self-review due tomorrow.",
    pain: "You're digging through Slack, old emails, trying to remember what you shipped in Q2.",
    solution: "Pull your accomplishments in seconds.",
  },
  {
    icon: Briefcase,
    moment: "Dream job just dropped. Apply by Friday.",
    pain: "Your resume is two roles behind. You haven't updated it since 2022.",
    solution: "Generate a tailored profile in minutes.",
  },
  {
    icon: TrendUp,
    moment: "Raise conversation next week.",
    pain: "You know you deserve it. But can you prove it?",
    solution: "Evidence ready. Confidence earned.",
  },
  {
    icon: Microphone,
    moment: "Conference bio needed by EOD.",
    pain: "Copy-paste from LinkedIn? It's stale. Write from scratch? No time.",
    solution: "Current bio, tailored to the event.",
  },
  {
    icon: PencilLine,
    moment: "LinkedIn post stuck in drafts.",
    pain: "You have thoughts. Articulating your expertise? Harder than it should be.",
    solution: "Your story, already synthesized.",
  },
];

export function RotatingScenarios() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setActiveIndex((prev) => (prev + 1) % scenarios.length);
        setIsTransitioning(false);
      }, 300);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const scenario = scenarios[activeIndex];
  const Icon = scenario.icon;

  return (
    <div className="relative">
      {/* Main card */}
      <div className="rounded-2xl border bg-card shadow-lg overflow-hidden">
        {/* Top accent bar */}
        <div className="h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/60" />

        <div className="p-8 md:p-12">
          <div
            className={`transition-all duration-300 ${
              isTransitioning ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
            }`}
          >
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Icon className="w-7 h-7 text-primary" />
              </div>
            </div>

            {/* The moment */}
            <p className="text-2xl md:text-3xl font-bold text-center mb-4">
              {scenario.moment}
            </p>

            {/* The pain */}
            <p className="text-center text-muted-foreground mb-6 max-w-lg mx-auto">
              {scenario.pain}
            </p>

            {/* Divider */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="h-px w-12 bg-border" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">with idynic</span>
              <div className="h-px w-12 bg-border" />
            </div>

            {/* The solution */}
            <p className="text-xl font-semibold text-primary text-center">
              {scenario.solution}
            </p>
          </div>
        </div>

        {/* Bottom section with indicators */}
        <div className="border-t bg-muted/30 px-8 py-4">
          <div className="flex justify-center gap-2">
            {scenarios.map((s, i) => (
              <button
                key={i}
                onClick={() => {
                  setIsTransitioning(true);
                  setTimeout(() => {
                    setActiveIndex(i);
                    setIsTransitioning(false);
                  }, 150);
                }}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === activeIndex
                    ? "w-8 bg-primary"
                    : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                }`}
                aria-label={`Scenario ${i + 1}: ${s.moment}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
