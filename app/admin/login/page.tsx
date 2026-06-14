import type { Metadata } from "next";
import { login } from "@/app/admin/auth-actions";

export const metadata: Metadata = { title: "Admin Login", robots: { index: false } };

export default function AdminLoginPage({
  searchParams,
}: {
  searchParams: { error?: string; next?: string };
}) {
  const hasError = searchParams.error === "1";
  const next = searchParams.next ?? "/admin";

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-5">
      <div className="w-full max-w-sm">
        <p className="font-display text-2xl uppercase tracking-brand text-bone">
          Game<span className="text-smoke">6</span> Admin
        </p>
        <p className="mt-2 font-body text-sm text-smoke">Sign in to manage the site.</p>

        <form action={login} className="mt-8 border border-bone/15 bg-steel p-6">
          <input type="hidden" name="next" value={next} />
          <label htmlFor="password" className="field-label">
            Admin Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoFocus
            className="field-input"
            placeholder="••••••••"
          />

          {hasError ? (
            <p className="mt-4 border border-red-500/40 bg-red-500/10 px-4 py-3 font-body text-sm text-red-200">
              Incorrect password. Try again.
            </p>
          ) : null}

          <button type="submit" className="btn-primary mt-6 w-full">
            Sign In
          </button>
        </form>
      </div>
    </main>
  );
}
