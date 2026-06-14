import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

// Public-facing chrome: header, footer, and the skip link. Admin lives under
// /admin with its own layout, so it doesn't inherit any of this.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-bone focus:px-4 focus:py-2 focus:font-heading focus:text-sm focus:uppercase focus:tracking-widest focus:text-ink"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
    </>
  );
}
