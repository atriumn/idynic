"use client";

interface CertificationItem {
  id: string;
  text: string;
  context: { issuer?: string; date?: string } | null;
}

export function CertificationsSection({
  items,
  onUpdate
}: {
  items: CertificationItem[];
  onUpdate: (items: CertificationItem[]) => void
}) {
  return <div className="border rounded-lg p-4">Certifications Section (placeholder)</div>;
}
