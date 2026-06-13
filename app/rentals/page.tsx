import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Court Rentals",
  description:
    "Court rentals at Game6 Sports Academy, Woodbridge ON. Limited availability, handled directly with our team.",
};

// Deliberately quiet, contact-only page. No public availability calendar and no
// far-in-advance public booking — bookings stay owner-controlled by phone, which
// is exactly how Game6 wants it.
export default function RentalsPage() {
  return (
    <section className="border-b border-bone/10 py-24">
      <div className="container-site max-w-3xl">
        <p className="eyebrow">Game6 Facility</p>
        <h1 className="mt-4 text-5xl leading-[0.95] text-bone sm:text-7xl">Court Rentals</h1>

        <p className="mt-8 font-body text-lg leading-relaxed text-smoke">
          Our courts in Woodbridge are available for rental when they&apos;re not in
          use by our programs and league. Availability is limited and changes week to
          week, so rentals are arranged directly with our team — not booked far in
          advance online.
        </p>

        <div className="mt-12 border border-bone/15 bg-steel p-8">
          <p className="eyebrow mb-4">Enquire</p>
          <p className="font-body text-base leading-relaxed text-bone">
            To check availability or request a slot, reach out to our team. We&apos;ll
            confirm what&apos;s open and get you on the court.
          </p>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="field-label">Location</p>
              <address className="not-italic font-body text-sm leading-relaxed text-smoke">
                241 Trade Valley Dr
                <br />
                Woodbridge, ON
              </address>
            </div>
            <div>
              <p className="field-label">Get in touch</p>
              <p className="font-body text-sm leading-relaxed text-smoke">
                Call or message us to arrange a rental. {/* Phone/email to be wired
                to Game6's preferred contact. */}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12">
          <Link href="/#free-class" className="btn-ghost">
            Looking for youth programs? Start here
          </Link>
        </div>
      </div>
    </section>
  );
}
