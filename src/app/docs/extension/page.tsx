"use client";

import Link from "next/link";
import Image from "next/image";

const sections = [
  { id: "introduction", label: "Introduction" },
  { id: "installation", label: "Installation" },
  { id: "setup", label: "Setup" },
  { id: "usage", label: "Usage" },
  { id: "troubleshooting", label: "Troubleshooting" },
];

export default function ExtensionDocsPage() {
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
            <h2 className="font-semibold mb-3">Chrome Extension</h2>
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
              href="https://chrome.google.com/webstore"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Chrome Web Store →
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
              <h1 className="text-3xl font-bold mb-4">Chrome Extension</h1>
              <p className="text-muted-foreground mb-4">
                Save job opportunities to Idynic with one click while browsing LinkedIn,
                Greenhouse, Lever, and other job boards.
              </p>
              <p className="text-muted-foreground">
                The extension automatically extracts job details, detects duplicates,
                and syncs with your Idynic account so you can track and analyze
                opportunities from anywhere.
              </p>
            </Left>
            <Right>
              <div className="rounded-lg overflow-hidden">
                <div className="bg-violet-900 px-4 py-2 text-xs text-violet-300 font-medium">Features</div>
                <div className="bg-violet-950/80 p-4 text-sm space-y-2">
                  <div>• One-click job saving</div>
                  <div>• LinkedIn job enrichment</div>
                  <div>• Duplicate detection</div>
                  <div>• Manual paste fallback</div>
                </div>
              </div>
            </Right>
          </Section>

          {/* Installation */}
          <Section id="installation">
            <Left>
              <h2 className="text-2xl font-bold mb-4">Installation</h2>
              <p className="text-muted-foreground mb-6">
                Install the Idynic extension from the Chrome Web Store.
              </p>

              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Chrome Web Store</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Click the button below to install from the Chrome Web Store.
                    The extension works with Chrome, Edge, Brave, and other Chromium browsers.
                  </p>
                  <a
                    href="https://chrome.google.com/webstore"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    <Image src="/logo.svg" alt="" width={20} height={20} />
                    Add to Chrome
                  </a>
                </div>
              </div>
            </Left>
            <Right>
              <CodeBlock
                title="Supported browsers"
                code={`Google Chrome
Microsoft Edge
Brave
Arc
Opera
Vivaldi`}
              />
            </Right>
          </Section>

          {/* Setup */}
          <Section id="setup">
            <Left>
              <h2 className="text-2xl font-bold mb-4">Setup</h2>
              <p className="text-muted-foreground mb-6">
                Connect the extension to your Idynic account with an API key.
              </p>

              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2">1. Get your API key</h3>
                  <p className="text-sm text-muted-foreground">
                    Log into Idynic, go to{" "}
                    <Link href="/settings/api-keys" className="text-primary hover:underline">
                      Settings → API Keys
                    </Link>
                    , and create a new key. Copy it immediately—it&apos;s only shown once.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">2. Open extension settings</h3>
                  <p className="text-sm text-muted-foreground">
                    Click the Idynic extension icon in your browser toolbar, then click
                    &quot;Open Settings&quot; (or right-click the icon and select &quot;Options&quot;).
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">3. Paste your API key</h3>
                  <p className="text-sm text-muted-foreground">
                    Paste your API key and click &quot;Save&quot;. The extension will verify
                    the connection and show a success message.
                  </p>
                </div>
              </div>
            </Left>
            <Right>
              <CodeBlock
                title="API key format"
                code="idn_xxxxxxxxxxxxxxxxxxxx"
              />
              <div className="rounded-lg overflow-hidden">
                <div className="bg-violet-900 px-4 py-2 text-xs text-violet-300 font-medium">Security</div>
                <div className="bg-violet-950/80 p-4 text-sm">
                  Your API key is stored locally in your browser and never sent to third parties.
                  You can revoke it anytime from Settings → API Keys.
                </div>
              </div>
            </Right>
          </Section>

          {/* Usage */}
          <Section id="usage">
            <Left>
              <h2 className="text-2xl font-bold mb-4">Usage</h2>
              <p className="text-muted-foreground mb-6">
                Save jobs while browsing any job board.
              </p>

              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2">Saving a job</h3>
                  <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                    <li>Navigate to a job posting on LinkedIn, Greenhouse, Lever, or any job site</li>
                    <li>Click the Idynic extension icon</li>
                    <li>Click &quot;Save Job&quot;</li>
                    <li>The job is added to your Opportunities in Idynic</li>
                  </ol>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">LinkedIn jobs</h3>
                  <p className="text-sm text-muted-foreground">
                    LinkedIn jobs are automatically enriched with additional metadata like
                    location, salary range, seniority level, and company logo.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Manual paste</h3>
                  <p className="text-sm text-muted-foreground">
                    If automatic extraction fails, click &quot;Paste description manually&quot;
                    to copy/paste the job description text directly.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Duplicate detection</h3>
                  <p className="text-sm text-muted-foreground">
                    The extension recognizes jobs you&apos;ve already saved and shows a link
                    to view the existing opportunity instead of creating duplicates.
                  </p>
                </div>
              </div>
            </Left>
            <Right>
              <CodeBlock
                title="Supported job boards"
                code={`LinkedIn Jobs
Greenhouse
Lever
Workday
Ashby
BambooHR
+ any job page URL`}
              />
              <div className="rounded-lg overflow-hidden">
                <div className="bg-violet-900 px-4 py-2 text-xs text-violet-300 font-medium">Pro tip</div>
                <div className="bg-violet-950/80 p-4 text-sm">
                  Pin the Idynic extension to your toolbar for quick access.
                  Click the puzzle piece icon → Pin Idynic.
                </div>
              </div>
            </Right>
          </Section>

          {/* Troubleshooting */}
          <Section id="troubleshooting">
            <Left>
              <h2 className="text-2xl font-bold mb-4">Troubleshooting</h2>
              <p className="text-muted-foreground mb-6">
                Common issues and solutions.
              </p>

              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2">&quot;Couldn&apos;t extract job&quot;</h3>
                  <p className="text-sm text-muted-foreground">
                    Some job pages have complex layouts that prevent automatic extraction.
                    Use the &quot;Paste description manually&quot; option to copy the job text
                    from the page and paste it directly.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">&quot;API key invalid&quot;</h3>
                  <p className="text-sm text-muted-foreground">
                    Your API key may have been revoked or expired. Go to{" "}
                    <Link href="/settings/api-keys" className="text-primary hover:underline">
                      Settings → API Keys
                    </Link>{" "}
                    in Idynic to create a new key, then update it in the extension settings.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">&quot;Network error&quot;</h3>
                  <p className="text-sm text-muted-foreground">
                    Check your internet connection. If the problem persists, Idynic may be
                    temporarily unavailable. Try again in a few minutes.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Extension not appearing</h3>
                  <p className="text-sm text-muted-foreground">
                    Click the puzzle piece icon in Chrome&apos;s toolbar to see all extensions.
                    Click the pin icon next to Idynic to keep it visible.
                  </p>
                </div>
              </div>
            </Left>
            <Right>
              <div className="rounded-lg overflow-hidden">
                <div className="bg-violet-900 px-4 py-2 text-xs text-violet-300 font-medium">Need help?</div>
                <div className="bg-violet-950/80 p-4 text-sm space-y-2">
                  <div>
                    <a href="mailto:support@idynic.com" className="text-violet-300 hover:text-white">
                      support@idynic.com
                    </a>
                  </div>
                  <div>
                    <a href="https://github.com/atriumn/idynic/issues" target="_blank" rel="noopener noreferrer" className="text-violet-300 hover:text-white">
                      GitHub Issues →
                    </a>
                  </div>
                </div>
              </div>
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
      <div className="bg-violet-900 px-4 py-2 text-xs text-violet-300 font-medium">{title}</div>
      <pre className="bg-violet-950/80 p-4 text-sm overflow-x-auto">
        <code>{code}</code>
      </pre>
    </div>
  );
}
