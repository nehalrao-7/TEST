type SeasonBannerProps = {
  label: string;
  year: number;
  registrationStatus: string; // OPEN | CLOSED | WAITLIST
  headline?: string | null;
};

const statusCopy: Record<string, string> = {
  OPEN: "Registration Open",
  CLOSED: "Registration Closed",
  WAITLIST: "Join the Waitlist",
};

// Data-driven season banner. This is the structural fix for the old site's
// hardcoded "Spring Season" banner — Game6 edits the active Season record
// (seed today, admin UI later) and this updates everywhere.
export function SeasonBanner({ label, year, registrationStatus, headline }: SeasonBannerProps) {
  const status = statusCopy[registrationStatus] ?? registrationStatus;
  const text = headline ?? `${label} ${year} Programs — ${status}`;

  return (
    <div className="border-b border-bone/10 bg-bone text-ink">
      <div className="container-site flex items-center justify-center gap-3 py-2.5 text-center">
        <span className="hidden h-1.5 w-1.5 shrink-0 rounded-full bg-accent-solid sm:block" />
        <p className="font-heading text-xs font-bold uppercase tracking-[0.2em]">{text}</p>
      </div>
    </div>
  );
}
