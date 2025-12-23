"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Pencil, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ContactData {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  website?: string;
  logo_url?: string;
}

interface ContactSectionProps {
  contact: ContactData;
  onUpdate: (contact: ContactData) => void;
}

const FIELD_LABELS: Record<keyof ContactData, string> = {
  name: "Name",
  email: "Email",
  phone: "Phone",
  location: "Location",
  linkedin: "LinkedIn",
  github: "GitHub",
  website: "Website",
  logo_url: "Logo URL",
};

// Normalize URL for display/linking - handles malformed extractions
function normalizeUrl(value: string, field: string): string {
  if (!value) return value;

  // Already a proper URL
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  // LinkedIn: extract username from various formats
  if (field === "linkedin") {
    // Match /in/username pattern
    const inMatch = value.match(/\/in\/([a-zA-Z0-9-]+)/);
    if (inMatch) {
      return `https://linkedin.com/in/${inMatch[1]}`;
    }
    // Just a username
    if (!value.includes("/") && !value.includes(".")) {
      return `https://linkedin.com/in/${value}`;
    }
  }

  // GitHub: extract username
  if (field === "github") {
    // Already has github.com
    if (value.toLowerCase().includes("github.com")) {
      return value.startsWith("http") ? value : `https://${value}`;
    }
    // Just a username
    if (!value.includes("/") && !value.includes(".")) {
      return `https://github.com/${value}`;
    }
  }

  // Default: prepend https://
  return `https://${value}`;
}

export function ContactSection({ contact, onUpdate }: ContactSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<ContactData>(contact);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/profile/contact", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save");
      }

      const updated = await response.json();
      onUpdate(updated);
      setIsEditing(false);
      toast.success("Contact info updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditData(contact);
    setIsEditing(false);
  };

  const fields: (keyof ContactData)[] = ["name", "email", "phone", "location", "linkedin", "github", "website", "logo_url"];

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger className="flex items-center gap-2 hover:text-foreground transition-colors">
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <CardTitle className="text-lg">Contact Info</CardTitle>
            </CollapsibleTrigger>
            {!isEditing && (
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                <Pencil className="h-4 w-4 mr-1" />
                Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent>
            {isEditing ? (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  {fields.map((field) => (
                    <div key={field} className="space-y-2">
                      <Label htmlFor={field}>{FIELD_LABELS[field]}</Label>
                      <Input
                        id={field}
                        type={field === "email" ? "email" : field.includes("url") || field === "linkedin" || field === "github" || field === "website" ? "url" : "text"}
                        value={editData[field] || ""}
                        onChange={(e) => setEditData({ ...editData, [field]: e.target.value || undefined })}
                        placeholder={`Enter ${FIELD_LABELS[field].toLowerCase()}`}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={handleCancel} disabled={isSaving}>
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 mr-1" />
                    )}
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <dl className="grid gap-2 sm:grid-cols-2">
                {fields.map((field) => (
                  <div key={field}>
                    <dt className="text-sm font-medium text-muted-foreground">{FIELD_LABELS[field]}</dt>
                    <dd className="text-sm">
                      {contact[field] ? (
                        field.includes("url") || field === "linkedin" || field === "github" || field === "website" ? (
                          <a
                            href={normalizeUrl(contact[field] as string, field)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline break-all"
                          >
                            {normalizeUrl(contact[field] as string, field)}
                          </a>
                        ) : (
                          contact[field]
                        )
                      ) : (
                        <span className="text-muted-foreground/50">Not set</span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
