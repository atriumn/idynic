"use client";

interface WorkHistoryItem {
  id: string;
  company: string;
  title: string;
  start_date: string;
  end_date: string | null;
  location: string | null;
  summary: string | null;
  company_domain: string | null;
  order_index: number;
}

export function WorkHistorySection({
  items,
  onUpdate
}: {
  items: WorkHistoryItem[];
  onUpdate: (items: WorkHistoryItem[]) => void
}) {
  return <div className="border rounded-lg p-4">Work History Section (placeholder)</div>;
}
