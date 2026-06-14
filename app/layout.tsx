import type { Metadata, Viewport } from "next";
import { Anton, Oswald, Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider, themeScript } from "@/components/theme/ThemeProvider";

// Display: heavy condensed all-caps. Heading: condensed grotesque. Body: clean.
const anton = Anton({ weight: "400", subsets: ["latin"], variable: "--font-display" });
const oswald = Oswald({ subsets: ["latin"], variable: "--font-heading" });
const inter = Inter({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  metadataBase: new URL("https://game6sportsacademy.com"),
  title: {
    default: "Game6 Sports Academy — Where Passion Meets Discipline",
    template: "%s — Game6 Sports Academy",
  },
  description:
    "Youth basketball in Woodbridge, ON. Get your kid a free league drop-in — come play, get evaluated live, and find their place in the league.",
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
    <html lang="en" className={`${anton.variable} ${oswald.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        {/* Sets the theme class before paint to avoid a flash of the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
