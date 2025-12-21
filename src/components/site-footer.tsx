import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t py-12 bg-muted/20">
      <div className="container px-4 mx-auto">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-1 md:col-span-2 space-y-4">
            <div className="flex items-center gap-2 font-semibold text-xl">
              <div className="w-8 h-8 bg-primary rounded-lg"></div>
              Idynic
            </div>
            <p className="text-muted-foreground max-w-xs">
              The AI-powered career companion that helps you tell your professional
              story.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Product</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/pricing" className="hover:text-foreground">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/recruiters" className="hover:text-foreground">
                  For Recruiters
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-foreground">
                  Login
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/contact" className="hover:text-foreground">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/legal/terms" className="hover:text-foreground">
                  Terms
                </Link>
              </li>
              <li>
                <Link href="/legal/privacy" className="hover:text-foreground">
                  Privacy
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t pt-8 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Idynic. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
