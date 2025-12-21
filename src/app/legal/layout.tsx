import Link from "next/link";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="grid md:grid-cols-[200px_1fr] gap-8">
        <aside className="space-y-4">
          <h3 className="font-semibold text-lg mb-4">Legal</h3>
          <nav className="flex flex-col space-y-2">
            <Link 
              href="/legal/terms" 
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Terms of Service
            </Link>
            <Link 
              href="/legal/privacy" 
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Privacy Policy
            </Link>
             <Link 
              href="/legal/cookies" 
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Cookie Policy
            </Link>
          </nav>
        </aside>
        <main className="prose dark:prose-invert max-w-none">
          {children}
        </main>
      </div>
    </div>
  );
}
