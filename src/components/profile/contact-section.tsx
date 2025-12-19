"use client";

export function ContactSection({
  contact,
  onUpdate
}: {
  contact: Record<string, string | undefined>;
  onUpdate: (contact: Record<string, string | undefined>) => void
}) {
  return <div className="border rounded-lg p-4">Contact Section (placeholder)</div>;
}
