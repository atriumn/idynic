import React from "react";
import { cn } from "@/lib/utils";

interface MeshBackgroundProps {
  className?: string;
  intensity?: "subtle" | "medium" | "strong";
}

export function MeshBackground({ className, intensity = "medium" }: MeshBackgroundProps) {
  const opacityClass = {
    subtle: "opacity-30 dark:opacity-20",
    medium: "opacity-50 dark:opacity-40",
    strong: "opacity-80 dark:opacity-60",
  }[intensity];

  return (
    <div className={cn("fixed inset-0 -z-50 h-full w-full bg-background overflow-hidden pointer-events-none", className)}>
      {/* Top Right - Teal/Cyan */}
      <div 
        className={cn(
          "absolute -top-[20%] -right-[10%] h-[500px] w-[500px] rounded-full bg-teal-500/20 blur-[120px] mix-blend-multiply dark:mix-blend-screen animate-pulse", 
          opacityClass
        )} 
        style={{ animationDuration: '7s' }}
      ></div>
      
      {/* Bottom Left - Purple/Indigo */}
      <div 
        className={cn(
          "absolute -bottom-[20%] -left-[10%] h-[600px] w-[600px] rounded-full bg-indigo-500/20 blur-[120px] mix-blend-multiply dark:mix-blend-screen", 
          opacityClass
        )}
      ></div>
      
      {/* Center - Subtle Primary */}
      <div 
        className={cn(
          "absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-[800px] w-[800px] rounded-full bg-primary/5 blur-[100px]", 
          opacityClass
        )}
      ></div>
    </div>
  );
}
