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

function optInt(fd: FormData, key: string): number | null {
  const v = str(fd, key);
  if (!v.length) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
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
      classSessionId: optStr(formData, "classSessionId"),
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
      classSessionId: optStr(formData, "classSessionId"),
      sortOrder: Number(str(formData, "sortOrder")) || 0,
      isActive: formData.get("isActive") === "on",
    },
  });
  revalidatePublic();
  revalidatePath("/admin/offers");
}

/* ---------------------------------- Courts --------------------------------- */

export async function createCourt(formData: FormData) {
  const count = await prisma.court.count();
  await prisma.court.create({
    data: { name: str(formData, "name") || `Court ${count + 1}`, sortOrder: count + 1 },
  });
  revalidatePath("/admin/classes");
}

export async function deleteCourt(formData: FormData) {
  await prisma.court.delete({ where: { id: str(formData, "id") } });
  revalidatePath("/admin/classes");
}

/* ------------------------------ Class Sessions ----------------------------- */

function classData(formData: FormData) {
  return {
    name: str(formData, "name") || "Class",
    weekday: optInt(formData, "weekday") ?? 1,
    startTime: str(formData, "startTime") || "18:00",
    endTime: str(formData, "endTime") || "19:00",
    capacity: optInt(formData, "capacity"),
    ageHint: optStr(formData, "ageHint"),
    notes: optStr(formData, "notes"),
    programId: optStr(formData, "programId"),
    courtId: optStr(formData, "courtId"),
  };
}

export async function createClassSession(formData: FormData) {
  await prisma.classSession.create({ data: { ...classData(formData), isActive: true } });
  revalidatePath("/admin/classes");
  revalidatePath("/admin/schedule");
}

export async function updateClassSession(formData: FormData) {
  await prisma.classSession.update({
    where: { id: str(formData, "id") },
    data: { ...classData(formData), isActive: formData.get("isActive") === "on" },
  });
  revalidatePath("/admin/classes");
  revalidatePath("/admin/schedule");
}

export async function deleteClassSession(formData: FormData) {
  await prisma.classSession.delete({ where: { id: str(formData, "id") } });
  revalidatePath("/admin/classes");
  revalidatePath("/admin/schedule");
}

/* --------------------------------- Bookings -------------------------------- */

const VALID_BOOKING_TYPE = new Set(["RENTAL", "PROGRAM", "HOLD"]);

function bookingData(formData: FormData) {
  const type = str(formData, "type").toUpperCase();
  const dateStr = str(formData, "date");
  return {
    title: str(formData, "title") || "Court Booking",
    type: VALID_BOOKING_TYPE.has(type) ? type : "RENTAL",
    date: dateStr ? new Date(`${dateStr}T00:00:00`) : new Date(),
    startTime: str(formData, "startTime") || "18:00",
    endTime: str(formData, "endTime") || "19:00",
    contact: optStr(formData, "contact"),
    notes: optStr(formData, "notes"),
    courtId: optStr(formData, "courtId"),
  };
}

export async function createBooking(formData: FormData) {
  await prisma.booking.create({ data: bookingData(formData) });
  revalidatePath("/admin/bookings");
}

export async function updateBooking(formData: FormData) {
  await prisma.booking.update({ where: { id: str(formData, "id") }, data: bookingData(formData) });
  revalidatePath("/admin/bookings");
}

export async function deleteBooking(formData: FormData) {
  await prisma.booking.delete({ where: { id: str(formData, "id") } });
  revalidatePath("/admin/bookings");
}

export async function deleteOffer(formData: FormData) {
  await prisma.offer.delete({ where: { id: str(formData, "id") } });
  revalidatePublic();
  revalidatePath("/admin/offers");
}
