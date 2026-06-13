import type { Metadata } from "next";
import { Anton, Oswald, Inter } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
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
  openGraph: {
    title: "Game6 Sports Academy — Where Passion Meets Discipline",
    description:
      "Youth basketball in Woodbridge, ON. Claim a free league drop-in for your kid.",
    type: "website",
    locale: "en_CA",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${anton.variable} ${oswald.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        {/* Sets the theme class before paint to avoid a flash of the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeProvider>
          <SiteHeader />
          <main>{children}</main>
          <SiteFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}
