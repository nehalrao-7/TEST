import type { Metadata, Viewport } from "next";
import "@fontsource/anton/400.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Muqabla Tournament",
  description: "Walk out of the tunnel and onto the Muqabla floor. Tournament updates, partners and official gear.",
};

export const viewport: Viewport = {
  themeColor: "#050506",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="is-loading">
      <body>{children}</body>
    </html>
  );
}
