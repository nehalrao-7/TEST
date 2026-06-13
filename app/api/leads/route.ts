import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendLeadNotification } from "@/lib/email";
import { leadSchema } from "@/lib/validation";

// Very small in-memory rate limit (per-IP, per-process). Good enough to blunt
// casual abuse; a production deployment behind multiple instances should move
// this to a shared store (e.g. Upstash) — noted in README.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  if (rateLimited(ip)) {
    return NextResponse.json(
      { ok: false, error: "Too many requests. Please try again in a minute." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    // Honeypot tripped or invalid input — return a generic field error map.
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return NextResponse.json({ ok: false, error: "Please check the form.", fieldErrors }, { status: 400 });
  }

  const data = parsed.data;

  // Honeypot: if the hidden field has any content, silently accept (don't tip
  // off bots) but do nothing.
  if (data.website) {
    return NextResponse.json({ ok: true });
  }

  try {
    await prisma.lead.create({
      data: {
        kidName: data.kidName,
        parentName: data.parentName,
        parentPhone: data.parentPhone,
        birthYear: data.birthYear,
        experience: data.experience || null,
        offerLabel: data.offerLabel || null,
      },
    });
  } catch (err) {
    console.error("[leads] failed to persist lead:", err);
    return NextResponse.json(
      { ok: false, error: "Something went wrong saving your spot. Please call us." },
      { status: 500 },
    );
  }

  // Email is best-effort: the lead is already saved, so a mail failure should
  // not surface as a form error to the parent.
  try {
    await sendLeadNotification({
      kidName: data.kidName,
      parentName: data.parentName,
      parentPhone: data.parentPhone,
      birthYear: data.birthYear,
      experience: data.experience || undefined,
      offerLabel: data.offerLabel || undefined,
    });
  } catch (err) {
    console.error("[leads] lead saved but notification failed:", err);
  }

  return NextResponse.json({ ok: true });
}
