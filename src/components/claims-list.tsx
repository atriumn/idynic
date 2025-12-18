import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Database } from "@/lib/supabase/types";

type Claim = Database["public"]["Tables"]["claims"]["Row"];

interface ClaimsListProps {
  claims: Claim[];
}

const CLAIM_TYPE_LABELS: Record<string, string> = {
  contact: "Contact",
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  skill: "Skill",
  certification: "Certification",
  project: "Project",
};

const CLAIM_TYPE_COLORS: Record<string, string> = {
  contact: "bg-blue-100 text-blue-800",
  summary: "bg-purple-100 text-purple-800",
  experience: "bg-green-100 text-green-800",
  education: "bg-yellow-100 text-yellow-800",
  skill: "bg-pink-100 text-pink-800",
  certification: "bg-orange-100 text-orange-800",
  project: "bg-cyan-100 text-cyan-800",
};

export function ClaimsList({ claims }: ClaimsListProps) {
  // Group claims by type
  const groupedClaims = claims.reduce(
    (acc, claim) => {
      const type = claim.claim_type;
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(claim);
      return acc;
    },
    {} as Record<string, Claim[]>
  );

  // Order: summary, contact, experience, education, skills, certifications, projects
  const orderedTypes = [
    "summary",
    "contact",
    "experience",
    "education",
    "skill",
    "certification",
    "project",
  ];

  return (
    <div className="space-y-6">
      {orderedTypes.map((type) => {
        const typeClaims = groupedClaims[type];
        if (!typeClaims || typeClaims.length === 0) return null;

        return (
          <Card key={type}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                {CLAIM_TYPE_LABELS[type] || type}
                <Badge variant="secondary" className="font-normal">
                  {typeClaims.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {type === "skill" ? (
                <div className="flex flex-wrap gap-2">
                  {typeClaims.map((claim) => (
                    <Badge
                      key={claim.id}
                      className={CLAIM_TYPE_COLORS[type]}
                      variant="secondary"
                    >
                      {(claim.value as { skill: string }).skill}
                    </Badge>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {typeClaims.map((claim) => (
                    <ClaimItem key={claim.id} claim={claim} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function ClaimItem({ claim }: { claim: Claim }) {
  const value = claim.value as Record<string, unknown>;

  switch (claim.claim_type) {
    case "contact": {
      const email = value.email as string | undefined;
      const location = value.location as string | undefined;
      return (
        <div className="text-sm">
          <p className="font-medium">{String(value.name)}</p>
          {email && <p className="text-muted-foreground">{email}</p>}
          {location && <p className="text-muted-foreground">{location}</p>}
        </div>
      );
    }

    case "summary":
      return (
        <p className="text-sm text-muted-foreground">
          {String(value.summary)}
        </p>
      );

    case "experience": {
      const bullets = value.bullets as string[] | undefined;
      const location = value.location as string | undefined;
      return (
        <div className="text-sm">
          <p className="font-medium">
            {String(value.role)} at {String(value.company)}
          </p>
          <p className="text-xs text-muted-foreground">
            {String(value.start_date)} - {value.is_current ? "Present" : String(value.end_date)}
            {location ? ` • ${location}` : ""}
          </p>
          {bullets && bullets.length > 0 && (
            <ul className="mt-2 list-disc list-inside text-muted-foreground">
              {bullets.slice(0, 3).map((bullet, i) => (
                <li key={i} className="truncate">
                  {bullet}
                </li>
              ))}
              {bullets.length > 3 && (
                <li className="text-xs">+{bullets.length - 3} more</li>
              )}
            </ul>
          )}
        </div>
      );
    }

    case "education": {
      const field = value.field as string | undefined;
      const gpa = value.gpa as string | undefined;
      return (
        <div className="text-sm">
          <p className="font-medium">
            {String(value.degree)}
            {field ? ` in ${field}` : ""}
          </p>
          <p className="text-muted-foreground">{String(value.school)}</p>
          {gpa && (
            <p className="text-xs text-muted-foreground">GPA: {gpa}</p>
          )}
        </div>
      );
    }

    case "certification": {
      const issuer = value.issuer as string | undefined;
      return (
        <div className="text-sm">
          <p className="font-medium">{String(value.name)}</p>
          {issuer && <p className="text-muted-foreground">{issuer}</p>}
        </div>
      );
    }

    case "project": {
      const description = value.description as string | undefined;
      const technologies = value.technologies as string[] | undefined;
      return (
        <div className="text-sm">
          <p className="font-medium">{String(value.name)}</p>
          {description && (
            <p className="text-muted-foreground">{description}</p>
          )}
          {technologies && technologies.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {technologies.map((tech, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {tech}
                </Badge>
              ))}
            </div>
          )}
        </div>
      );
    }

    default:
      return (
        <p className="text-sm text-muted-foreground">{claim.evidence_text}</p>
      );
  }
}
