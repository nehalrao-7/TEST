import type { Metadata, Viewport } from "next";
import { Archivo, Oswald, Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider, themeScript } from "@/components/theme/ThemeProvider";
import { Analytics } from "@vercel/analytics/react";
import { JsonLd } from "@/components/seo/JsonLd";
import { GoogleAnalytics } from "@/components/seo/GoogleAnalytics";
import { SITE_URL, organizationJsonLd, websiteJsonLd } from "@/lib/seo";

// Display: wide, heavy grotesque (Archivo expanded/black). Heading: condensed
// grotesque for labels. Body: clean sans.
const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-display" });
const oswald = Oswald({ subsets: ["latin"], variable: "--font-heading" });
const inter = Inter({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Game6 Sports Academy | Youth Basketball in Woodbridge & Vaughan",
    template: "%s | Game6 Sports Academy",
  },
  description:
    "Youth basketball league, training, rep teams & camps in Woodbridge, ON — serving Vaughan and the GTA. Get your kid a free league drop-in: come play, get evaluated live, and find their place.",
  alternates: { canonical: "/" },
  keywords: [
    "youth basketball Woodbridge",
    "basketball academy Vaughan",
    "kids basketball league",
    "basketball training Woodbridge ON",
    "Game6 Sports Academy",
  ],
  openGraph: {
    title: "Game6 Sports Academy — Where Passion Meets Discipline",
    description:
      "Youth basketball in Woodbridge, ON. Claim a free league drop-in for your kid.",
    type: "website",
    locale: "en_CA",
    siteName: "Game6 Sports Academy",
  },
  twitter: {
    card: "summary_large_image",
    title: "Game6 Sports Academy — Where Passion Meets Discipline",
    description: "Youth basketball in Woodbridge, ON. Claim a free league drop-in for your kid.",
  },
};

// theme_color adapts the mobile browser chrome to whichever theme is active.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f3" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${oswald.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        {/* Sets the theme class before paint to avoid a flash of the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <JsonLd data={organizationJsonLd()} />
        <JsonLd data={websiteJsonLd()} />
        <GoogleAnalytics />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
