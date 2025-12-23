import Link from "next/link";
import Image from "next/image";

export function SiteFooter() {
  return (
    <footer className="border-t py-12 bg-muted/20">
      <div className="container px-4 mx-auto">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-1 md:col-span-2 space-y-4">
            <div className="flex items-center gap-2 font-semibold text-xl">
              <Image
                src="/logo.svg"
                alt="Idynic"
                width={32}
                height={32}
                className="h-8 w-8"
              />
              Idynic
            </div>
            <p className="text-muted-foreground max-w-xs">
              The AI-powered career companion that helps you tell your professional
              story.
            </p>
            <div className="flex gap-3 pt-2">
              <Link
                href="#"
                className="opacity-80 hover:opacity-100 transition-opacity"
                aria-label="Download on the App Store"
              >
                <Image
                  src="/app-store-badge.svg"
                  alt="Download on the App Store"
                  width={120}
                  height={40}
                  className="h-10 w-auto"
                />
              </Link>
              <Link
                href="#"
                className="opacity-80 hover:opacity-100 transition-opacity"
                aria-label="Get it on Google Play"
              >
                <Image
                  src="/google-play-badge.svg"
                  alt="Get it on Google Play"
                  width={135}
                  height={40}
                  className="h-10 w-auto"
                />
              </Link>
            </div>
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
