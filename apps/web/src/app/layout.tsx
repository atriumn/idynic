import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Nav } from "@/components/nav";
import { Providers } from "@/components/providers";
import { createClient } from "@/lib/supabase/server";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Idynic - Smart Career Companion",
  description:
    "Upload your resume, track opportunities, and get AI-powered talking points tailored to each role.",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/favicon-64x64.png", sizes: "64x64", type: "image/png" },
      { url: "/favicon-128x128.png", sizes: "128x128", type: "image/png" },
      { url: "/favicon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/favicon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Idynic - Smart Career Companion",
    description:
      "Upload your resume, track opportunities, and get AI-powered talking points tailored to each role.",
    url: "https://idynic.com",
    siteName: "Idynic",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Idynic - Smart Career Companion",
    description:
      "Upload your resume, track opportunities, and get AI-powered talking points tailored to each role.",
  },
};

import { SiteFooter } from "@/components/site-footer";
import { CookieConsent } from "@/components/cookie-consent";

// ... existing imports

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <Nav user={user} />
          <main>{children}</main>
          <SiteFooter />
          <CookieConsent />
        </Providers>
      </body>
    </html>
  );
}
