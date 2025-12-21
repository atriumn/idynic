"use client";

import { useState, useEffect } from "react";

const scenarios = [
  {
    moment: "It's 9pm. Self-review due tomorrow.",
    pain: "You're digging through Slack, old emails, trying to remember what you shipped in Q2.",
    solution: "Pull your accomplishments in seconds.",
  },
  {
    moment: "Dream job just dropped. Apply by Friday.",
    pain: "Your resume is two roles behind. You haven't updated it since 2022.",
    solution: "Generate a tailored profile in minutes.",
  },
  {
    moment: "Raise conversation next week.",
    pain: "You know you deserve it. But can you prove it?",
    solution: "Evidence ready. Confidence earned.",
  },
  {
    moment: "Conference bio needed by EOD.",
    pain: "Copy-paste from LinkedIn? It's stale. Write from scratch? No time.",
    solution: "Current bio, tailored to the event.",
  },
  {
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

  return (
    <div className="relative">
      {/* Scenario indicators */}
      <div className="flex justify-center gap-2 mb-8">
        {scenarios.map((_, i) => (
          <button
            key={i}
            onClick={() => {
              setIsTransitioning(true);
              setTimeout(() => {
                setActiveIndex(i);
                setIsTransitioning(false);
              }, 150);
            }}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === activeIndex
                ? "w-8 bg-primary"
                : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
            }`}
            aria-label={`Scenario ${i + 1}`}
          />
        ))}
      </div>

      {/* Main content */}
      <div
        className={`transition-all duration-300 ${
          isTransitioning ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
        }`}
      >
        <div className="text-center max-w-2xl mx-auto space-y-6">
          {/* The moment */}
          <p className="text-2xl md:text-3xl font-bold text-foreground">
            {scenario.moment}
          </p>

          {/* The pain */}
          <p className="text-lg text-muted-foreground italic">
            {scenario.pain}
          </p>

          {/* The solution */}
          <p className="text-lg font-medium text-primary">
            {scenario.solution}
          </p>
        </div>
      </div>
    </div>
  );
}
