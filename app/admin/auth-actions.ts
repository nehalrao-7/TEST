"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_COOKIE,
  ADMIN_COOKIE_MAX_AGE,
  createSessionToken,
  passwordMatches,
} from "@/lib/auth";

export async function login(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const requested = String(formData.get("next") ?? "/admin");
  // Only allow same-app admin redirects (no open redirect).
  const next = requested.startsWith("/admin") ? requested : "/admin";

  if (!passwordMatches(password)) {
    redirect(`/admin/login?error=1&next=${encodeURIComponent(next)}`);
  }

  const token = await createSessionToken();
  cookies().set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_COOKIE_MAX_AGE,
  });

  redirect(next);
}

export async function logout() {
  cookies().delete(ADMIN_COOKIE);
  redirect("/admin/login");
}
