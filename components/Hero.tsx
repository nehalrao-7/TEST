import Link from "next/link";

// Hero leads with the brand line and drives straight to the free-class funnel.
// The video slot is a marked placeholder for the intro reel — drop the real
// MP4 at /public/video/intro-reel.mp4 (or a poster image) to swap it in.
export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-bone/10">
      {/* Intro reel slot — replace the gradient block with a <video> when the
          real reel is available (see README "Swapping in real assets"). */}
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,#1f1f1f,transparent_55%),radial-gradient(circle_at_80%_80%,#161616,transparent_50%)]"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 opacity-[0.06] [background-image:repeating-linear-gradient(90deg,#fff_0,#fff_1px,transparent_1px,transparent_42px)]"
        aria-hidden="true"
      />

      <div className="container-site relative flex min-h-[78vh] flex-col justify-center py-24">
        <p className="eyebrow animate-fade-up">Youth Basketball · Woodbridge, ON</p>

        <h1 className="mt-5 max-w-4xl animate-fade-up text-5xl leading-[0.92] text-bone sm:text-7xl lg:text-8xl">
          Where Passion
          <br />
          Meets Discipline
        </h1>

        <p className="mt-7 max-w-xl animate-fade-up font-body text-lg leading-relaxed text-smoke">
          This is where players are made. Bring your kid in for a{" "}
          <span className="text-bone">free league drop-in</span> — they play, we watch,
          and we find exactly where they belong.
        </p>

        <div className="mt-10 flex animate-fade-up flex-col gap-4 sm:flex-row">
          <Link href="#free-class" className="btn-primary">
            Claim Your Free Drop-In
          </Link>
          <Link href="#programs" className="btn-ghost">
            Explore Programs
          </Link>
        </div>
      </div>
    </section>
  );
}
