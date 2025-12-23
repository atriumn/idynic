import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    lineHeight: 1.4,
    color: "#1a1a1a",
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: "#2563eb",
    paddingBottom: 15,
  },
  name: {
    fontSize: 26,
    fontWeight: 700,
    marginBottom: 8,
    color: "#111827",
    letterSpacing: 0.5,
  },
  contactInfo: {
    fontSize: 11,
    color: "#4b5563",
    marginTop: 4,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 8,
    color: "#1e40af",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  summary: {
    fontSize: 10,
    lineHeight: 1.5,
    color: "#374151",
  },
  experienceItem: {
    marginBottom: 12,
  },
  experienceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  experienceLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  companyLogo: {
    width: 24,
    height: 24,
    borderRadius: 4,
  },
  jobInfo: {
    flexDirection: "column",
  },
  jobTitle: {
    fontSize: 11,
    fontWeight: 600,
  },
  company: {
    fontSize: 10,
    color: "#4b5563",
  },
  dates: {
    fontSize: 10,
    color: "#6b7280",
  },
  bullet: {
    flexDirection: "row",
    marginBottom: 3,
    paddingLeft: 8,
  },
  bulletPoint: {
    width: 12,
    fontSize: 10,
  },
  bulletText: {
    flex: 1,
    fontSize: 10,
  },
  skillsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  skillCategory: {
    marginBottom: 6,
  },
  skillCategoryName: {
    fontSize: 10,
    fontWeight: 600,
    marginBottom: 2,
  },
  skillList: {
    fontSize: 10,
    color: "#374151",
  },
  educationItem: {
    marginBottom: 6,
  },
  degree: {
    fontSize: 10,
    fontWeight: 600,
  },
  institution: {
    fontSize: 10,
    color: "#4b5563",
  },
  ventureItem: {
    marginBottom: 8,
  },
  ventureName: {
    fontSize: 11,
    fontWeight: 600,
  },
  ventureRole: {
    fontSize: 10,
    color: "#4b5563",
  },
  ventureDescription: {
    fontSize: 10,
    color: "#374151",
    marginTop: 2,
  },
});

interface SkillCategory {
  category: string;
  skills: string[];
}

interface Experience {
  company: string;
  companyDomain?: string | null;
  title: string;
  dates: string;
  location: string | null;
  bullets: string[];
}

interface Venture {
  name: string;
  role: string;
  status: string | null;
  description: string | null;
}

interface Education {
  institution: string;
  degree: string;
  year: string | null;
}

export interface ResumeDocumentProps {
  name: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  website?: string;
  summary: string;
  skills: SkillCategory[];
  experience: Experience[];
  additionalExperience?: Experience[];
  ventures?: Venture[];
  education: Education[];
}

// Get logo URL for a company domain using logo.dev
function getLogoUrl(domain: string | null | undefined): string | null {
  if (!domain) return null;
  const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `https://img.logo.dev/${cleanDomain}?token=pk_b3U88G0OTNKjNTpAlTU_OQ&retina=true`;
}

// Parse **bold** text into segments
function parseBoldText(text: string): Array<{ text: string; bold: boolean }> {
  const segments: Array<{ text: string; bold: boolean }> = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), bold: false });
    }
    segments.push({ text: match[1], bold: true });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), bold: false });
  }

  return segments.length > 0 ? segments : [{ text, bold: false }];
}

function BulletText({ text }: { text: string }) {
  const segments = parseBoldText(text);
  return (
    <Text style={styles.bulletText}>
      {segments.map((segment, i) => (
        <Text key={i} style={segment.bold ? { fontWeight: 600 } : {}}>
          {segment.text}
        </Text>
      ))}
    </Text>
  );
}

export function ResumeDocument({
  name,
  email,
  phone,
  location,
  linkedin,
  github,
  website,
  summary,
  skills,
  experience,
  additionalExperience = [],
  ventures = [],
  education,
}: ResumeDocumentProps) {
  // Build contact line: email | phone | location
  const primaryContact = [email, phone, location].filter(Boolean).join(" | ");

  // Build links line: LinkedIn | GitHub | Website (show clean URLs)
  const links = [
    linkedin && `LinkedIn: ${linkedin.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, "").replace(/\/$/, "")}`,
    github && `GitHub: ${github.replace(/^https?:\/\/(www\.)?github\.com\//, "").replace(/\/$/, "")}`,
    website && website.replace(/^https?:\/\//, "").replace(/\/$/, ""),
  ].filter(Boolean).join(" | ");

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.name}>{name}</Text>
          {primaryContact && <Text style={styles.contactInfo}>{primaryContact}</Text>}
          {links && <Text style={styles.contactInfo}>{links}</Text>}
        </View>

        {/* Summary */}
        {summary && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Professional Summary</Text>
            <Text style={styles.summary}>{summary}</Text>
          </View>
        )}

        {/* Experience */}
        {experience.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Experience</Text>
            {experience.map((job, idx) => {
              const logoUrl = getLogoUrl(job.companyDomain);
              return (
                <View key={idx} style={styles.experienceItem}>
                  <View style={styles.experienceHeader}>
                    <View style={styles.experienceLeft}>
                      {/* @react-pdf/renderer Image does not support alt prop - not HTML */}
                      {logoUrl && (
                        // eslint-disable-next-line jsx-a11y/alt-text
                        <Image src={logoUrl} style={styles.companyLogo} />
                      )}
                      <View style={styles.jobInfo}>
                        <Text style={styles.jobTitle}>{job.title}</Text>
                        <Text style={styles.company}>{job.company}{job.location ? ` - ${job.location}` : ""}</Text>
                      </View>
                    </View>
                    <Text style={styles.dates}>{job.dates}</Text>
                  </View>
                  {job.bullets.map((bullet, bIdx) => (
                    <View key={bIdx} style={styles.bullet}>
                      <Text style={styles.bulletPoint}>•</Text>
                      <BulletText text={bullet} />
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
        )}

        {/* Additional Experience */}
        {additionalExperience.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Experience</Text>
            {additionalExperience.map((job, idx) => {
              const logoUrl = getLogoUrl(job.companyDomain);
              return (
                <View key={idx} style={styles.experienceItem}>
                  <View style={styles.experienceHeader}>
                    <View style={styles.experienceLeft}>
                      {/* @react-pdf/renderer Image does not support alt prop - not HTML */}
                      {logoUrl && (
                        // eslint-disable-next-line jsx-a11y/alt-text
                        <Image src={logoUrl} style={styles.companyLogo} />
                      )}
                      <View style={styles.jobInfo}>
                        <Text style={styles.jobTitle}>{job.title}</Text>
                        <Text style={styles.company}>{job.company}</Text>
                      </View>
                    </View>
                    <Text style={styles.dates}>{job.dates}</Text>
                  </View>
                  {job.bullets.map((bullet, bIdx) => (
                    <View key={bIdx} style={styles.bullet}>
                      <Text style={styles.bulletPoint}>•</Text>
                      <BulletText text={bullet} />
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
        )}

        {/* Ventures */}
        {ventures.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ventures & Projects</Text>
            {ventures.map((venture, idx) => (
              <View key={idx} style={styles.ventureItem}>
                <Text style={styles.ventureName}>
                  {venture.name}
                  {venture.status && ` (${venture.status})`}
                </Text>
                <Text style={styles.ventureRole}>{venture.role}</Text>
                {venture.description && (
                  <Text style={styles.ventureDescription}>{venture.description}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Skills */}
        {skills.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Skills</Text>
            {skills.map((cat, idx) => (
              <View key={idx} style={styles.skillCategory}>
                <Text style={styles.skillCategoryName}>{cat.category}:</Text>
                <Text style={styles.skillList}>{cat.skills.join(", ")}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Education */}
        {education.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Education</Text>
            {education.map((edu, idx) => (
              <View key={idx} style={styles.educationItem}>
                <Text style={styles.degree}>{edu.degree}</Text>
                <Text style={styles.institution}>
                  {edu.institution}
                  {edu.year && ` - ${edu.year}`}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
}
