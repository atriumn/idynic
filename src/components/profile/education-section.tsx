"use client";

interface EducationItem {
  id: string;
  text: string;
  context: {
    school?: string;
    degree?: string;
    field?: string;
    start_date?: string;
    end_date?: string;
  } | null;
}

export function EducationSection({
  items,
  onUpdate
}: {
  items: EducationItem[];
  onUpdate: (items: EducationItem[]) => void
}) {
  return <div className="border rounded-lg p-4">Education Section (placeholder)</div>;
}
