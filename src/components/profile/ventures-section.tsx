"use client";

interface VentureItem {
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

export function VenturesSection({
  items,
  onUpdate
}: {
  items: VentureItem[];
  onUpdate: (items: VentureItem[]) => void
}) {
  return <div className="border rounded-lg p-4">Ventures Section (placeholder)</div>;
}
