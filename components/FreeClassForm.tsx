"use client";

import { useState } from "react";
import { track } from "@vercel/analytics";

type Offer = { id: string; label: string };

type FormState = "idle" | "submitting" | "success" | "error";

export function FreeClassForm({ offers }: { offers: Offer[] }) {
  const [state, setState] = useState<FormState>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("submitting");
    setError(null);

    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        setError(json.error ?? "Something went wrong. Please try again or call us.");
        setState("error");
        return;
      }

      form.reset();
      // Conversion event for analytics / the marketing retainer's reporting.
      track("free_class_lead");
      if (typeof window !== "undefined" && (window as { gtag?: (...a: unknown[]) => void }).gtag) {
        (window as unknown as { gtag: (...a: unknown[]) => void }).gtag("event", "generate_lead");
      }
      setState("success");
    } catch {
      setError("Network error. Please try again or give us a call.");
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div className="border border-bone/20 bg-steel p-10 text-center">
        <p className="font-display text-4xl uppercase tracking-brand text-bone">You&apos;re in.</p>
        <p className="mt-4 font-body text-base leading-relaxed text-smoke">
          We got your spot. A coach will call you shortly to confirm the details and
          tell you exactly which class to come to. Get ready to hoop.
        </p>
        <button
          type="button"
          onClick={() => setState("idle")}
          className="btn-ghost mt-8"
        >
          Sign up another player
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="border border-bone/15 bg-steel p-6 sm:p-8">
      {/* Honeypot — hidden from humans, catches bots. */}
      <div className="absolute left-[-9999px]" aria-hidden="true">
        <label htmlFor="website">Leave this empty</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="kidName" className="field-label">
            Player&apos;s Name *
          </label>
          <input id="kidName" name="kidName" required className="field-input" placeholder="Jordan" />
        </div>
        <div>
          <label htmlFor="parentName" className="field-label">
            Your Name *
          </label>
          <input id="parentName" name="parentName" required className="field-input" placeholder="Parent / guardian" />
        </div>
        <div>
          <label htmlFor="parentPhone" className="field-label">
            Your Phone *
          </label>
          <input
            id="parentPhone"
            name="parentPhone"
            required
            type="tel"
            inputMode="tel"
            className="field-input"
            placeholder="(905) 555-0123"
          />
        </div>
        <div>
          <label htmlFor="birthYear" className="field-label">
            Player&apos;s Birth Year
          </label>
          <input
            id="birthYear"
            name="birthYear"
            type="number"
            min={1990}
            max={new Date().getFullYear()}
            className="field-input"
            placeholder="2015"
          />
        </div>
      </div>

      {offers.length > 0 ? (
        <div className="mt-5">
          <label htmlFor="offerLabel" className="field-label">
            Which drop-in?
          </label>
          <select id="offerLabel" name="offerLabel" defaultValue="" className="field-input">
            <option value="">Not sure — help me pick</option>
            {offers.map((o) => (
              <option key={o.id} value={o.label}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="mt-5">
        <label htmlFor="experience" className="field-label">
          Basketball Experience
        </label>
        <textarea
          id="experience"
          name="experience"
          rows={3}
          className="field-input resize-none"
          placeholder="New to the game? Plays rec? Competitive? Tell us a little."
        />
      </div>

      {state === "error" && error ? (
        <p className="mt-5 border border-red-500/40 bg-red-500/10 px-4 py-3 font-body text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={state === "submitting"} className="btn-primary mt-7 w-full disabled:opacity-60">
        {state === "submitting" ? "Sending…" : "Claim My Free Drop-In"}
      </button>

      <p className="mt-4 text-center font-body text-xs text-smoke">
        Free, no commitment. A coach will call to confirm your class.
      </p>
    </form>
  );
}
