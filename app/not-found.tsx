import Link from "next/link";

export default function NotFound() {
  return (
    <section className="border-b border-bone/10">
      <div className="container-site flex min-h-[70vh] flex-col justify-center py-24">
        <p className="eyebrow">Off the court</p>
        <h1 className="mt-5 text-6xl leading-[0.9] text-bone sm:text-8xl">
          Air Ball
          <br />
          404
        </h1>
        <p className="mt-6 max-w-lg font-body text-lg leading-relaxed text-smoke">
          That page isn&apos;t on our roster. Let&apos;s get you back in the game.
        </p>
        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <Link href="/" className="btn-primary">
            Back to Home
          </Link>
          <Link href="/#free-class" className="btn-ghost">
            Claim a Free Drop-In
          </Link>
        </div>
      </div>
    </section>
  );
}
