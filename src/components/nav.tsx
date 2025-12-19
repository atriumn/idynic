"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import type { User } from "@supabase/supabase-js";

interface NavProps {
  user: User | null;
}

export function Nav({ user }: NavProps) {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <nav className="border-b bg-background">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-semibold text-lg">
            <Image
              src="/logo.svg"
              alt="Idynic"
              width={28}
              height={28}
              className="h-7 w-7"
            />
            Idynic
          </Link>
          {user && (
            <div className="flex items-center gap-4">
              <Link
                href="/profile"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Profile
              </Link>
              <Link
                href="/identity"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Identity
              </Link>
              <Link
                href="/opportunities"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Opportunities
              </Link>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <>
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {user.email}
              </span>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </>
          ) : (
            <Button asChild size="sm">
              <Link href="/login">Login</Link>
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
