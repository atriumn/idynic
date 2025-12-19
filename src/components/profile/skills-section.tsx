"use client";

interface SkillItem {
  id: string;
  label: string;
  description: string | null;
  confidence: number;
  source: string;
}

export function SkillsSection({
  items,
  onUpdate
}: {
  items: SkillItem[];
  onUpdate: (items: SkillItem[]) => void
}) {
  return <div className="border rounded-lg p-4">Skills Section (placeholder)</div>;
}
