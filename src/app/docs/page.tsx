import Link from "next/link";
import { Code, Cpu } from "lucide-react";

export default function DocsPage() {
  return (
    <div className="container mx-auto px-4 py-20 max-w-4xl">
      <div className="space-y-8">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">Documentation</h1>
          <p className="text-xl text-muted-foreground">
            Build integrations with Idynic using our REST API or MCP server.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 pt-8">
          <Link
            href="/docs/api"
            className="group p-6 rounded-xl border bg-card hover:border-primary transition-colors"
          >
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <Code className="w-6 h-6 text-primary" />
            </div>
            <h2 className="font-semibold text-xl mb-2 group-hover:text-primary transition-colors">
              REST API
            </h2>
            <p className="text-muted-foreground">
              Access profiles, claims, and opportunities programmatically.
              Create tailored profiles and share links via API.
            </p>
          </Link>

          <Link
            href="/docs/mcp"
            className="group p-6 rounded-xl border bg-card hover:border-primary transition-colors"
          >
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <Cpu className="w-6 h-6 text-primary" />
            </div>
            <h2 className="font-semibold text-xl mb-2 group-hover:text-primary transition-colors">
              MCP Server
            </h2>
            <p className="text-muted-foreground">
              Use Idynic directly from Claude, Cursor, or any MCP-compatible client.
              Manage your career with natural language.
            </p>
          </Link>
        </div>

      </div>
    </div>
  );
}
