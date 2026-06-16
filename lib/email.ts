import { Resend } from "resend";

type LeadEmailPayload = {
  kidName: string;
  parentName: string;
  parentPhone: string;
  birthYear?: number;
  experience?: string;
  offerLabel?: string;
};

/**
 * Emails a new free-class lead to Game6 instantly.
 *
 * If RESEND_API_KEY is not set (e.g. local dev), this logs the payload instead
 * of failing, so the funnel is fully testable without a provider key. Wire a
 * real key in production via env (see README). An SMTP/nodemailer alternative
 * can be dropped in here without touching callers.
 */
export async function sendLeadNotification(lead: LeadEmailPayload): Promise<{ delivered: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.LEAD_NOTIFY_EMAIL;
  const from = process.env.RESEND_FROM ?? "Game6 Leads <onboarding@resend.dev>";

  const lines = [
    `New free-class lead from the website:`,
    ``,
    `Player:      ${lead.kidName}`,
    `Parent:      ${lead.parentName}`,
    `Phone:       ${lead.parentPhone}`,
    lead.birthYear ? `Birth year:  ${lead.birthYear}` : null,
    lead.experience ? `Experience:  ${lead.experience}` : null,
    lead.offerLabel ? `Offer:       ${lead.offerLabel}` : null,
    ``,
    `Call them, ask about the kid's experience, and tell them which class to come to.`,
  ].filter(Boolean);

  const text = lines.join("\n");
  const subject = `New free-class lead: ${lead.kidName} (${lead.parentPhone})`;

  if (!apiKey || !to) {
    console.warn(
      "[email] RESEND_API_KEY or LEAD_NOTIFY_EMAIL not set, logging lead instead of sending:\n%s",
      text,
    );
    return { delivered: false };
  }

  const resend = new Resend(apiKey);
  await resend.emails.send({ from, to, subject, text });
  return { delivered: true };
}
