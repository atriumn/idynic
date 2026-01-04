"use client";

import Link from "next/link";

const sections = [
  { id: "introduction", label: "Introduction" },
  { id: "installation", label: "Installation" },
  { id: "configuration", label: "Configuration" },
  { id: "tools", label: "Tools" },
  { id: "resources", label: "Resources" },
];

export default function McpDocsPage() {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r bg-muted/30 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto hidden lg:block">
        <div className="p-6 space-y-6">
          <div>
            <Link
              href="/docs"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Back to Docs
            </Link>
          </div>
          <div>
            <h2 className="font-semibold mb-3">MCP Server</h2>
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
            <a
              href="https://www.npmjs.com/package/@atriumn/idynic-mcp"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              npm package →
            </a>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        <div className="divide-y">
          {/* Introduction */}
          <Section id="introduction">
            <Left>
              <h1 className="text-3xl font-bold mb-4">MCP Server</h1>
              <p className="text-muted-foreground mb-4">
                The Idynic MCP server lets you manage your career directly from
                Claude Desktop, Cursor, or any MCP-compatible AI assistant.
              </p>
              <p className="text-muted-foreground">
                MCP (Model Context Protocol) is an open standard for connecting
                AI applications to external tools and data sources. With the
                Idynic MCP server, your AI assistant can access your profile,
                track opportunities, and generate tailored applications.
              </p>
            </Left>
            <Right>
              <CodeBlock title="Package" code="@atriumn/idynic-mcp" />
              <CodeBlock
                title="Requirements"
                code={`Node.js >= 18
IDYNIC_API_KEY`}
              />
            </Right>
          </Section>

          {/* Installation */}
          <Section id="installation">
            <Left>
              <h2 className="text-2xl font-bold mb-4">Installation</h2>
              <p className="text-muted-foreground mb-6">
                Install globally via npm, or run directly with npx without
                installation.
              </p>

              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Global install</h3>
                  <p className="text-sm text-muted-foreground">
                    Install once and run from anywhere.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">npx (no install)</h3>
                  <p className="text-sm text-muted-foreground">
                    Run directly without installing. Best for quick testing.
                  </p>
                </div>
              </div>
            </Left>
            <Right>
              <CodeBlock
                title="Global install"
                code="npm install -g @atriumn/idynic-mcp"
              />
              <CodeBlock
                title="Run with npx"
                code="npx -y @atriumn/idynic-mcp"
              />
            </Right>
          </Section>

          {/* Configuration */}
          <Section id="configuration">
            <Left>
              <h2 className="text-2xl font-bold mb-4">Configuration</h2>
              <p className="text-muted-foreground mb-6">
                Add the Idynic MCP server to your AI client&apos;s
                configuration.
              </p>

              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2">1. Get your API key</h3>
                  <p className="text-sm text-muted-foreground">
                    Log into Idynic, go to{" "}
                    <Link
                      href="/settings/api-keys"
                      className="text-primary hover:underline"
                    >
                      Settings → API Keys
                    </Link>
                    , and create a new key. Copy it immediately—it&apos;s only
                    shown once.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">
                    2. Add to Claude Desktop
                  </h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Edit your Claude Desktop config file:
                  </p>
                  <code className="text-xs bg-muted px-2 py-1 rounded block">
                    ~/.config/claude/claude_desktop_config.json
                  </code>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Environment variables</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex gap-3">
                      <code className="font-mono shrink-0">IDYNIC_API_KEY</code>
                      <span className="text-muted-foreground">
                        Required. Your API key.
                      </span>
                    </div>
                    <div className="flex gap-3">
                      <code className="font-mono shrink-0">IDYNIC_API_URL</code>
                      <span className="text-muted-foreground">
                        Optional. Custom API endpoint.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Left>
            <Right>
              <CodeBlock
                title="Claude Desktop config"
                code={`{
  "mcpServers": {
    "idynic": {
      "command": "npx",
      "args": ["-y", "@atriumn/idynic-mcp"],
      "env": {
        "IDYNIC_API_KEY": "idn_your_key"
      }
    }
  }
}`}
              />
            </Right>
          </Section>

          {/* Tools */}
          <Section id="tools">
            <Left>
              <h2 className="text-2xl font-bold mb-4">Tools</h2>
              <p className="text-muted-foreground mb-6">
                Tools are functions your AI assistant can call. They perform
                actions like updating your profile or creating share links.
              </p>

              <div className="space-y-6">
                <ToolItem
                  name="get_profile"
                  description="Get your full profile including contact info, work history, skills, and education."
                />
                <ToolItem
                  name="update_profile"
                  description="Update your contact information."
                  params="name, email, phone, location, linkedin, github, website"
                />
                <ToolItem
                  name="get_claims"
                  description="Get your identity claims—skills, achievements, education, and certifications with confidence scores."
                />
                <ToolItem
                  name="list_opportunities"
                  description="List all tracked job opportunities with match scores."
                  params="status (optional)"
                />
                <ToolItem
                  name="add_opportunity"
                  description="Add a new job opportunity by URL or pasting the description."
                  params="description (required), url (optional)"
                />
                <ToolItem
                  name="analyze_match"
                  description="Get match analysis for a job—shows strengths, gaps, and recommendations."
                  params="id"
                />
                <ToolItem
                  name="get_tailored_profile"
                  description="Get the tailored profile for a specific opportunity."
                  params="id"
                />
                <ToolItem
                  name="create_share_link"
                  description="Create a shareable link for a tailored profile."
                  params="id"
                />
                <ToolItem
                  name="add_and_tailor"
                  description="Add opportunity + generate tailored profile in one step."
                  params="description (required), url (optional)"
                />
                <ToolItem
                  name="add_tailor_share"
                  description="Add opportunity + tailor + create share link (all-in-one)."
                  params="description (required), url (optional)"
                />
              </div>
            </Left>
            <Right>
              <CodeBlock
                title="Example: Add job and get share link"
                code={`"I found a Senior Engineer role at Acme.
Here's the description: [paste].
Add it and create a share link."

→ Uses add_tailor_share tool
→ Returns shareable URL`}
              />
              <CodeBlock
                title="Example: Analyze fit"
                code={`"How well do I match the Acme role?"

→ Uses analyze_match tool
→ Returns strengths, gaps,
  recommendations`}
              />
              <CodeBlock
                title="Example: Update profile"
                code={`"Update my location to NYC"

→ Uses update_profile tool
→ Confirms update`}
              />
            </Right>
          </Section>

          {/* Resources */}
          <Section id="resources">
            <Left>
              <h2 className="text-2xl font-bold mb-4">Resources</h2>
              <p className="text-muted-foreground mb-6">
                Resources provide read-only access to your data via URI
                patterns. Your AI assistant can read these to understand
                context.
              </p>

              <div className="space-y-4">
                <ResourceItem
                  uri="idynic://profile"
                  description="User profile with contact info and work history"
                />
                <ResourceItem
                  uri="idynic://claims"
                  description="Skills, education, and certifications with confidence"
                />
                <ResourceItem
                  uri="idynic://opportunities"
                  description="List of tracked job opportunities"
                />
                <ResourceItem
                  uri="idynic://work-history"
                  description="Work history entries"
                />
                <ResourceItem
                  uri="idynic://opportunity/{id}"
                  description="Specific opportunity details"
                />
                <ResourceItem
                  uri="idynic://opportunity/{id}/match"
                  description="Match analysis for an opportunity"
                />
              </div>
            </Left>
            <Right>
              <CodeBlock
                title="Resource URIs"
                code={`idynic://profile
idynic://claims
idynic://opportunities
idynic://work-history
idynic://opportunity/{id}
idynic://opportunity/{id}/match`}
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
    <div className="lg:w-[420px] shrink-0 bg-violet-950 text-violet-100 p-6 lg:p-8 space-y-4 lg:sticky lg:top-14 lg:self-start lg:max-h-[calc(100vh-3.5rem)] lg:overflow-y-auto">
      {children}
    </div>
  );
}

function CodeBlock({ title, code }: { title: string; code: string }) {
  return (
    <div className="rounded-lg overflow-hidden">
      <div className="bg-violet-900 px-4 py-2 text-xs text-violet-300 font-medium">
        {title}
      </div>
      <pre className="bg-violet-950/80 p-4 text-sm overflow-x-auto">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function ToolItem({
  name,
  description,
  params,
}: {
  name: string;
  description: string;
  params?: string;
}) {
  return (
    <div className="border-l-2 border-violet-500/50 pl-4">
      <code className="font-mono text-sm font-medium text-violet-600 dark:text-violet-400">
        {name}
      </code>
      <p className="text-sm text-muted-foreground mt-1">{description}</p>
      {params && (
        <p className="text-xs text-muted-foreground mt-1">
          <span className="font-medium">Params:</span> {params}
        </p>
      )}
    </div>
  );
}

function ResourceItem({
  uri,
  description,
}: {
  uri: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <code className="font-mono text-sm bg-muted px-2 py-1 rounded shrink-0">
        {uri}
      </code>
      <span className="text-sm text-muted-foreground">{description}</span>
    </div>
  );
}
