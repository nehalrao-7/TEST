"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

// All mutations revalidate the public home page so edits show immediately.
function revalidatePublic() {
  revalidatePath("/");
}

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

function optStr(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return v.length ? v : null;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const VALID_STATUS = new Set(["OPEN", "CLOSED", "WAITLIST"]);

/* ---------------------------------- Season --------------------------------- */

export async function updateSeason(formData: FormData) {
  const id = str(formData, "id");
  const status = str(formData, "registrationStatus").toUpperCase();
  await prisma.season.update({
    where: { id },
    data: {
      label: str(formData, "label") || "Season",
      year: Number(str(formData, "year")) || new Date().getFullYear(),
      registrationStatus: VALID_STATUS.has(status) ? status : "OPEN",
      headline: optStr(formData, "headline"),
    },
  });
  revalidatePublic();
  revalidatePath("/admin/season");
}

/* --------------------------------- Programs -------------------------------- */

export async function updateProgram(formData: FormData) {
  const id = str(formData, "id");
  await prisma.program.update({
    where: { id },
    data: {
      name: str(formData, "name") || "Untitled Program",
      blurb: str(formData, "blurb"),
      details: str(formData, "details"),
      weeklyCadence: optStr(formData, "weeklyCadence"),
      ageHint: optStr(formData, "ageHint"),
      sortOrder: Number(str(formData, "sortOrder")) || 0,
      isActive: formData.get("isActive") === "on",
    },
  });
  revalidatePublic();
  revalidatePath("/admin/programs");
}

export async function createProgram(formData: FormData) {
  const name = str(formData, "name") || "New Program";
  let slug = slugify(name) || `program-${Date.now()}`;
  // Ensure slug uniqueness.
  if (await prisma.program.findUnique({ where: { slug } })) {
    slug = `${slug}-${Date.now().toString().slice(-4)}`;
  }
  const count = await prisma.program.count();
  await prisma.program.create({
    data: {
      slug,
      name,
      blurb: str(formData, "blurb"),
      details: str(formData, "details"),
      weeklyCadence: optStr(formData, "weeklyCadence"),
      ageHint: optStr(formData, "ageHint"),
      sortOrder: count + 1,
      isActive: true,
    },
  });
  revalidatePublic();
  revalidatePath("/admin/programs");
}

export async function deleteProgram(formData: FormData) {
  await prisma.program.delete({ where: { id: str(formData, "id") } });
  revalidatePublic();
  revalidatePath("/admin/programs");
}

/* ---------------------------------- Offers --------------------------------- */

export async function createOffer(formData: FormData) {
  const count = await prisma.offer.count();
  await prisma.offer.create({
    data: {
      label: str(formData, "label") || "Free Drop-In",
      ageRangeLabel: optStr(formData, "ageRangeLabel"),
      mappedClassNote: optStr(formData, "mappedClassNote"),
      sortOrder: count + 1,
      isActive: true,
    },
  });
  revalidatePublic();
  revalidatePath("/admin/offers");
}

export async function updateOffer(formData: FormData) {
  await prisma.offer.update({
    where: { id: str(formData, "id") },
    data: {
      label: str(formData, "label") || "Free Drop-In",
      ageRangeLabel: optStr(formData, "ageRangeLabel"),
      mappedClassNote: optStr(formData, "mappedClassNote"),
      sortOrder: Number(str(formData, "sortOrder")) || 0,
      isActive: formData.get("isActive") === "on",
    },
  });
  revalidatePublic();
  revalidatePath("/admin/offers");
}

export async function deleteOffer(formData: FormData) {
  await prisma.offer.delete({ where: { id: str(formData, "id") } });
  revalidatePublic();
  revalidatePath("/admin/offers");
}
