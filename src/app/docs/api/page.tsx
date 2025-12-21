"use client";

import { useState } from "react";
import Link from "next/link";

const sections = [
  { id: "introduction", label: "Introduction" },
  { id: "authentication", label: "Authentication" },
  { id: "errors", label: "Errors" },
  { id: "profile", label: "Profile" },
  { id: "claims", label: "Claims" },
  { id: "opportunities", label: "Opportunities" },
  { id: "documents", label: "Documents" },
  { id: "shared", label: "Shared Profiles" },
];

export default function ApiDocsPage() {
  const [language, setLanguage] = useState<"curl" | "javascript" | "python">("curl");

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r bg-muted/30 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto hidden lg:block">
        <div className="p-6 space-y-6">
          <div>
            <Link href="/docs" className="text-sm text-muted-foreground hover:text-foreground">
              ← Back to Docs
            </Link>
          </div>
          <div>
            <h2 className="font-semibold mb-3">API Reference</h2>
            <nav className="space-y-1">
              {sections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="block text-sm text-muted-foreground hover:text-foreground py-1.5 transition-colors"
                >
                  {section.label}
                </a>
              ))}
            </nav>
          </div>
          <div className="pt-4 border-t">
            <Link
              href="/api/v1/openapi.json"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              OpenAPI Spec →
            </Link>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        {/* Language switcher */}
        <div className="sticky top-14 z-10 bg-background border-b px-6 py-3 flex items-center gap-2">
          <span className="text-sm text-muted-foreground mr-2">Language:</span>
          {(["curl", "javascript", "python"] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                language === lang
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {lang === "curl" ? "cURL" : lang === "javascript" ? "Node.js" : "Python"}
            </button>
          ))}
        </div>

        {/* Sections */}
        <div className="divide-y">
          {/* Introduction */}
          <Section id="introduction">
            <Left>
              <h1 className="text-3xl font-bold mb-4">Idynic API</h1>
              <p className="text-muted-foreground mb-4">
                The Idynic API is organized around REST. Our API has predictable resource-oriented
                URLs, returns JSON-encoded responses, and uses standard HTTP response codes.
              </p>
              <div className="space-y-2">
                <h3 className="font-semibold">Base URL</h3>
                <code className="text-sm bg-muted px-2 py-1 rounded">https://idynic.com/api/v1</code>
              </div>
            </Left>
            <Right>
              <CodeBlock
                title="Base URL"
                code="https://idynic.com/api/v1"
              />
            </Right>
          </Section>

          {/* Authentication */}
          <Section id="authentication">
            <Left>
              <h2 className="text-2xl font-bold mb-4">Authentication</h2>
              <p className="text-muted-foreground mb-4">
                The Idynic API uses API keys to authenticate requests. You can manage your API keys
                in your{" "}
                <Link href="/settings/api-keys" className="text-primary hover:underline">
                  account settings
                </Link>
                .
              </p>
              <p className="text-muted-foreground mb-4">
                Authentication is performed via the <code className="text-sm bg-muted px-1 rounded">Authorization</code> header
                using Bearer authentication.
              </p>
              <p className="text-muted-foreground">
                All API requests must be made over HTTPS. Calls made over plain HTTP will fail.
              </p>
            </Left>
            <Right>
              <CodeBlock
                title="Authenticated request"
                code={codeExamples.auth[language]}
              />
            </Right>
          </Section>

          {/* Errors */}
          <Section id="errors">
            <Left>
              <h2 className="text-2xl font-bold mb-4">Errors</h2>
              <p className="text-muted-foreground mb-4">
                Idynic uses conventional HTTP response codes to indicate the success or failure of
                an API request.
              </p>
              <div className="space-y-3 mt-6">
                <ErrorCode code="200" desc="OK - Request succeeded" />
                <ErrorCode code="400" desc="Bad Request - Invalid parameters" />
                <ErrorCode code="401" desc="Unauthorized - Invalid or missing API key" />
                <ErrorCode code="403" desc="Forbidden - Not allowed to access resource" />
                <ErrorCode code="404" desc="Not Found - Resource doesn't exist" />
                <ErrorCode code="429" desc="Too Many Requests - Rate limit exceeded" />
                <ErrorCode code="500" desc="Server Error - Something went wrong" />
              </div>
            </Left>
            <Right>
              <CodeBlock
                title="Error response"
                code={`{
  "error": {
    "code": "invalid_request",
    "message": "Missing required field: description",
    "request_id": "req_abc123"
  }
}`}
              />
            </Right>
          </Section>

          {/* Profile */}
          <Section id="profile">
            <Left>
              <h2 className="text-2xl font-bold mb-4">Profile</h2>
              <p className="text-muted-foreground mb-6">
                The Profile object contains your contact information and work history.
              </p>

              <Endpoint method="GET" path="/profile" desc="Retrieve your profile" />
              <div className="mt-4 text-sm text-muted-foreground">
                Returns the current user&apos;s profile including contact info, work history, skills,
                education, and certifications.
              </div>

              <div className="mt-8">
                <Endpoint method="PATCH" path="/profile" desc="Update contact info" />
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2">Parameters</h4>
                  <ParamList>
                    <Param name="name" type="string" desc="Full name" />
                    <Param name="email" type="string" desc="Email address" />
                    <Param name="phone" type="string" desc="Phone number" />
                    <Param name="location" type="string" desc="City, State" />
                    <Param name="linkedin" type="string" desc="LinkedIn URL" />
                    <Param name="github" type="string" desc="GitHub URL" />
                    <Param name="website" type="string" desc="Personal website URL" />
                  </ParamList>
                </div>
              </div>
            </Left>
            <Right>
              <CodeBlock
                title="Get profile"
                code={codeExamples.getProfile[language]}
              />
              <CodeBlock
                title="Response"
                code={`{
  "contact": {
    "name": "Jane Smith",
    "email": "jane@example.com",
    "location": "San Francisco, CA"
  },
  "experience": [...],
  "skills": [...],
  "education": [...]
}`}
              />
            </Right>
          </Section>

          {/* Claims */}
          <Section id="claims">
            <Left>
              <h2 className="text-2xl font-bold mb-4">Claims</h2>
              <p className="text-muted-foreground mb-6">
                Claims represent your skills, achievements, education, and certifications—each with
                a confidence score indicating how well it&apos;s supported by evidence.
              </p>

              <Endpoint method="GET" path="/claims" desc="List all claims" />
              <div className="mt-4 text-sm text-muted-foreground">
                Returns all identity claims for the current user.
              </div>
            </Left>
            <Right>
              <CodeBlock
                title="Get claims"
                code={codeExamples.getClaims[language]}
              />
              <CodeBlock
                title="Response"
                code={`[
  {
    "id": "clm_abc123",
    "type": "skill",
    "label": "TypeScript",
    "description": "5+ years experience",
    "confidence": 0.92
  },
  {
    "id": "clm_def456",
    "type": "certification",
    "label": "AWS Solutions Architect",
    "confidence": 1.0
  }
]`}
              />
            </Right>
          </Section>

          {/* Opportunities */}
          <Section id="opportunities">
            <Left>
              <h2 className="text-2xl font-bold mb-4">Opportunities</h2>
              <p className="text-muted-foreground mb-6">
                Opportunities represent job postings you&apos;re tracking. Add an opportunity, generate
                a tailored profile, and create shareable links.
              </p>

              <Endpoint method="GET" path="/opportunities" desc="List opportunities" />
              <div className="mt-2 mb-6">
                <h4 className="text-sm font-medium mb-2">Query parameters</h4>
                <ParamList>
                  <Param name="status" type="string" desc="Filter by: tracking, applied, interviewing, offered, rejected" optional />
                </ParamList>
              </div>

              <Endpoint method="POST" path="/opportunities" desc="Add opportunity" />
              <div className="mt-2 mb-6">
                <h4 className="text-sm font-medium mb-2">Body parameters</h4>
                <ParamList>
                  <Param name="description" type="string" desc="Job description text" required />
                  <Param name="url" type="string" desc="Job posting URL" optional />
                </ParamList>
              </div>

              <Endpoint method="POST" path="/opportunities/:id/tailor" desc="Generate tailored profile" />
              <div className="mt-2 mb-6 text-sm text-muted-foreground">
                Generates a tailored profile for this opportunity based on your identity.
              </div>

              <Endpoint method="POST" path="/opportunities/:id/share" desc="Create share link" />
              <div className="mt-2 mb-6 text-sm text-muted-foreground">
                Creates a shareable link to your tailored profile.
              </div>

              <div className="mt-8 p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">Convenience endpoints</h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <code className="text-primary">POST /opportunities/add-and-tailor</code>
                    <p className="text-muted-foreground">Add + generate tailored profile</p>
                  </div>
                  <div>
                    <code className="text-primary">POST /opportunities/add-tailor-share</code>
                    <p className="text-muted-foreground">Add + tailor + create share link (all-in-one)</p>
                  </div>
                </div>
              </div>
            </Left>
            <Right>
              <CodeBlock
                title="Add and create share link"
                code={codeExamples.addTailorShare[language]}
              />
              <CodeBlock
                title="Response"
                code={`{
  "opportunity": {
    "id": "opp_xyz789",
    "title": "Senior Engineer",
    "company": "Acme Corp",
    "match_score": 0.87
  },
  "share_link": {
    "url": "https://idynic.com/s/abc123",
    "expires_at": null
  }
}`}
              />
            </Right>
          </Section>

          {/* Documents */}
          <Section id="documents">
            <Left>
              <h2 className="text-2xl font-bold mb-4">Documents</h2>
              <p className="text-muted-foreground mb-6">
                Upload resumes and career stories to build your identity.
              </p>

              <Endpoint method="POST" path="/documents/resume" desc="Upload resume" />
              <div className="mt-2 mb-6">
                <h4 className="text-sm font-medium mb-2">Body (multipart/form-data)</h4>
                <ParamList>
                  <Param name="file" type="file" desc="PDF or DOCX file" required />
                </ParamList>
              </div>

              <Endpoint method="POST" path="/documents/story" desc="Add career story" />
              <div className="mt-2">
                <h4 className="text-sm font-medium mb-2">Body parameters</h4>
                <ParamList>
                  <Param name="content" type="string" desc="Story text (free-form)" required />
                  <Param name="title" type="string" desc="Optional title" optional />
                </ParamList>
              </div>
            </Left>
            <Right>
              <CodeBlock
                title="Upload resume"
                code={codeExamples.uploadResume[language]}
              />
              <CodeBlock
                title="Add story"
                code={codeExamples.addStory[language]}
              />
            </Right>
          </Section>

          {/* Shared */}
          <Section id="shared">
            <Left>
              <h2 className="text-2xl font-bold mb-4">Shared Profiles</h2>
              <p className="text-muted-foreground mb-6">
                Public endpoints for accessing shared profiles. No authentication required.
              </p>

              <Endpoint method="GET" path="/shared/:token" desc="Get shared profile" />
              <div className="mt-2 mb-6 text-sm text-muted-foreground">
                Returns the tailored profile for a share link. No auth required.
              </div>

              <Endpoint method="GET" path="/shared/:token/summary" desc="Get AI summary" />
              <div className="mt-2 text-sm text-muted-foreground">
                Returns an AI-generated summary of the candidate for quick review.
              </div>
            </Left>
            <Right>
              <CodeBlock
                title="Get shared profile"
                code={codeExamples.getShared[language]}
              />
              <CodeBlock
                title="Summary response"
                code={`{
  "candidate_name": "Jane Smith",
  "summary": "Senior engineer with 8+ years...",
  "generated_at": "2024-01-15T10:30:00Z"
}`}
              />
            </Right>
          </Section>
        </div>
      </main>
    </div>
  );
}

// Layout components
function Section({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28">
      <div className="flex flex-col lg:flex-row">{children}</div>
    </section>
  );
}

function Left({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 p-6 lg:p-8 lg:pr-12">{children}</div>;
}

function Right({ children }: { children: React.ReactNode }) {
  return (
    <div className="lg:w-[420px] shrink-0 bg-slate-900 text-slate-100 p-6 lg:p-8 space-y-4 lg:sticky lg:top-28 lg:self-start lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
      {children}
    </div>
  );
}

function CodeBlock({
  title,
  code,
}: {
  title: string;
  code: string;
}) {
  return (
    <div className="rounded-lg overflow-hidden">
      <div className="bg-slate-800 px-4 py-2 text-xs text-slate-400 font-medium">{title}</div>
      <pre className="bg-slate-950 p-4 text-sm overflow-x-auto">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function Endpoint({ method, path, desc }: { method: string; path: string; desc: string }) {
  const colors: Record<string, string> = {
    GET: "bg-green-500/20 text-green-400 border-green-500/30",
    POST: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    PATCH: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    DELETE: "bg-red-500/20 text-red-400 border-red-500/30",
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
      <span className={`px-2 py-0.5 text-xs font-mono font-bold rounded border ${colors[method]}`}>
        {method}
      </span>
      <code className="font-mono text-sm">{path}</code>
      <span className="text-sm text-muted-foreground ml-auto hidden sm:block">{desc}</span>
    </div>
  );
}

function ParamList({ children }: { children: React.ReactNode }) {
  return <div className="space-y-2 text-sm">{children}</div>;
}

function Param({
  name,
  type,
  desc,
  required,
  optional,
}: {
  name: string;
  type: string;
  desc: string;
  required?: boolean;
  optional?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 py-1">
      <code className="font-mono text-sm shrink-0">{name}</code>
      <span className="text-muted-foreground text-xs shrink-0">{type}</span>
      {required && <span className="text-xs text-red-500 shrink-0">required</span>}
      {optional && <span className="text-xs text-muted-foreground shrink-0">optional</span>}
      <span className="text-muted-foreground">{desc}</span>
    </div>
  );
}

function ErrorCode({ code, desc }: { code: string; desc: string }) {
  return (
    <div className="flex items-center gap-3">
      <code className="font-mono text-sm w-12">{code}</code>
      <span className="text-sm text-muted-foreground">{desc}</span>
    </div>
  );
}

// Code examples for different languages
const codeExamples = {
  auth: {
    curl: `curl https://idynic.com/api/v1/profile \\
  -H "Authorization: Bearer idn_your_api_key"`,
    javascript: `const response = await fetch(
  'https://idynic.com/api/v1/profile',
  {
    headers: {
      'Authorization': 'Bearer idn_your_api_key'
    }
  }
);`,
    python: `import requests

response = requests.get(
    'https://idynic.com/api/v1/profile',
    headers={'Authorization': 'Bearer idn_your_api_key'}
)`,
  },
  getProfile: {
    curl: `curl https://idynic.com/api/v1/profile \\
  -H "Authorization: Bearer idn_..."`,
    javascript: `const profile = await fetch(
  'https://idynic.com/api/v1/profile',
  { headers: { Authorization: 'Bearer idn_...' } }
).then(r => r.json());`,
    python: `profile = requests.get(
    'https://idynic.com/api/v1/profile',
    headers={'Authorization': 'Bearer idn_...'}
).json()`,
  },
  getClaims: {
    curl: `curl https://idynic.com/api/v1/claims \\
  -H "Authorization: Bearer idn_..."`,
    javascript: `const claims = await fetch(
  'https://idynic.com/api/v1/claims',
  { headers: { Authorization: 'Bearer idn_...' } }
).then(r => r.json());`,
    python: `claims = requests.get(
    'https://idynic.com/api/v1/claims',
    headers={'Authorization': 'Bearer idn_...'}
).json()`,
  },
  addTailorShare: {
    curl: `curl -X POST https://idynic.com/api/v1/opportunities/add-tailor-share \\
  -H "Authorization: Bearer idn_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "description": "Senior Software Engineer at Acme..."
  }'`,
    javascript: `const result = await fetch(
  'https://idynic.com/api/v1/opportunities/add-tailor-share',
  {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer idn_...',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      description: 'Senior Software Engineer at Acme...'
    })
  }
).then(r => r.json());`,
    python: `result = requests.post(
    'https://idynic.com/api/v1/opportunities/add-tailor-share',
    headers={'Authorization': 'Bearer idn_...'},
    json={'description': 'Senior Software Engineer at Acme...'}
).json()`,
  },
  uploadResume: {
    curl: `curl -X POST https://idynic.com/api/v1/documents/resume \\
  -H "Authorization: Bearer idn_..." \\
  -F "file=@resume.pdf"`,
    javascript: `const formData = new FormData();
formData.append('file', fileInput.files[0]);

await fetch(
  'https://idynic.com/api/v1/documents/resume',
  {
    method: 'POST',
    headers: { Authorization: 'Bearer idn_...' },
    body: formData
  }
);`,
    python: `with open('resume.pdf', 'rb') as f:
    requests.post(
        'https://idynic.com/api/v1/documents/resume',
        headers={'Authorization': 'Bearer idn_...'},
        files={'file': f}
    )`,
  },
  addStory: {
    curl: `curl -X POST https://idynic.com/api/v1/documents/story \\
  -H "Authorization: Bearer idn_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Leading the platform migration",
    "content": "In 2023, I led a team of 5..."
  }'`,
    javascript: `await fetch(
  'https://idynic.com/api/v1/documents/story',
  {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer idn_...',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: 'Leading the platform migration',
      content: 'In 2023, I led a team of 5...'
    })
  }
);`,
    python: `requests.post(
    'https://idynic.com/api/v1/documents/story',
    headers={'Authorization': 'Bearer idn_...'},
    json={
        'title': 'Leading the platform migration',
        'content': 'In 2023, I led a team of 5...'
    }
)`,
  },
  getShared: {
    curl: `curl https://idynic.com/api/v1/shared/abc123`,
    javascript: `const profile = await fetch(
  'https://idynic.com/api/v1/shared/abc123'
).then(r => r.json());`,
    python: `profile = requests.get(
    'https://idynic.com/api/v1/shared/abc123'
).json()`,
  },
};
