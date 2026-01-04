"use client";

import { useEffect, useState } from "react";
import { ContactSection } from "@/components/profile/contact-section";
import { WorkHistorySection } from "@/components/profile/work-history-section";
import { VenturesSection } from "@/components/profile/ventures-section";
import { SkillsSection } from "@/components/profile/skills-section";
import { CertificationsSection } from "@/components/profile/certifications-section";
import { EducationSection } from "@/components/profile/education-section";
import { Skeleton } from "@/components/ui/skeleton";

interface ProfileData {
  contact: {
    name?: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    github?: string;
    website?: string;
    logo_url?: string;
  };
  workHistory: Array<{
    id: string;
    company: string;
    title: string;
    start_date: string;
    end_date: string | null;
    location: string | null;
    summary: string | null;
    company_domain: string | null;
    order_index: number;
  }>;
  ventures: Array<{
    id: string;
    company: string;
    title: string;
    start_date: string;
    end_date: string | null;
    location: string | null;
    summary: string | null;
    company_domain: string | null;
    order_index: number;
  }>;
  skills: Array<{
    id: string;
    label: string;
    description: string | null;
    confidence: number;
    source: string;
  }>;
  certifications: Array<{
    id: string;
    text: string;
    context: { issuer?: string; date?: string } | null;
  }>;
  education: Array<{
    id: string;
    text: string;
    context: {
      school?: string;
      degree?: string;
      field?: string;
      start_date?: string;
      end_date?: string;
    } | null;
  }>;
}

export function ProfileContent() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const response = await fetch("/api/profile");
        if (!response.ok) {
          throw new Error("Failed to fetch profile");
        }
        const data = await response.json();
        setProfile(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load profile");
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="space-y-6">
      <ContactSection
        contact={profile.contact}
        onUpdate={(contact) => setProfile({ ...profile, contact })}
      />
      <WorkHistorySection
        items={profile.workHistory}
        onUpdate={(workHistory) => setProfile({ ...profile, workHistory })}
      />
      <VenturesSection
        items={profile.ventures}
        onUpdate={(ventures) => setProfile({ ...profile, ventures })}
      />
      <SkillsSection
        items={profile.skills}
        onUpdate={(skills) => setProfile({ ...profile, skills })}
      />
      <CertificationsSection
        items={profile.certifications}
        onUpdate={(certifications) =>
          setProfile({ ...profile, certifications })
        }
      />
      <EducationSection
        items={profile.education}
        onUpdate={(education) => setProfile({ ...profile, education })}
      />
    </div>
  );
}
