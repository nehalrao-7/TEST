import { z } from "zod";

const currentYear = new Date().getFullYear();

// Lead capture payload. `website` is a honeypot, real users never fill it.
export const leadSchema = z.object({
  kidName: z.string().trim().min(1, "Player name is required").max(120),
  parentName: z.string().trim().min(1, "Your name is required").max(120),
  parentPhone: z
    .string()
    .trim()
    .min(7, "A valid phone number is required")
    .max(30)
    .regex(/^[0-9+()\-.\s]+$/, "Phone can only contain digits and + ( ) - ."),
  birthYear: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === "") return undefined;
      const n = typeof v === "number" ? v : parseInt(v, 10);
      return Number.isNaN(n) ? undefined : n;
    })
    .refine(
      (n) => n === undefined || (n >= 1990 && n <= currentYear),
      `Birth year must be between 1990 and ${currentYear}`,
    ),
  experience: z.string().trim().max(500).optional().or(z.literal("")),
  offerLabel: z.string().trim().max(200).optional().or(z.literal("")),
  // Honeypot: real users never see this field. We accept any value here and
  // handle a filled honeypot silently in the route (a 200 with no save), so
  // bots get no signal that they were caught.
  website: z.string().max(200).optional(),
});

export type LeadInput = z.infer<typeof leadSchema>;
