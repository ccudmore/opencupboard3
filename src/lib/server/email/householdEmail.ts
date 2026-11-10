import { z } from "zod";
import prisma from "$lib/prisma";
import { ClientRelationship } from "$prisma/enums";
import { env as privateEnv } from "$env/dynamic/private";
import { env as publicEnv } from "$env/dynamic/public";
import { isMailConfigured, sendMail } from "./mailer";
import { renderTemplate } from "./templates";

/**
 * Tells a household that signed up online that it was approved, and gives it its ID and the booking page.
 * Returns the addresses it was sent to (none when email isn't set up or the household gave no address).
 */
export async function sendApprovalEmail(
  householdId: string,
): Promise<string[]> {
  if (!isMailConfigured()) return [];
  const household = await prisma.household.findUnique({
    where: { id: householdId },
    include: {
      members: { where: { relationship: ClientRelationship.PRIMARY } },
    },
  });
  if (!household?.uniqueId) return [];

  const to = [
    ...new Set(
      household.members
        .map((m) => (m.email ?? "").trim())
        .filter((e) => z.email().safeParse(e).success),
    ),
  ];
  if (to.length === 0) return [];

  const names = household.members
    .map((m) => m.firstName.trim())
    .filter(Boolean);
  const firstNames =
    names.length > 1
      ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
      : (names[0] ?? "");
  const base = (privateEnv.BETTER_AUTH_URL ?? "").replace(/\/$/, "");
  const { subject, body } = await renderTemplate("household-approved", {
    firstNames,
    uniqueId: household.uniqueId,
    bookingUrl: `${base}/book`,
    organization: publicEnv.PUBLIC_ORGANIZATION_NAME || "Open Cupboard",
  });
  try {
    await sendMail({ to, subject, text: body });
    return to;
  } catch (err) {
    console.error("Sending the approval email failed:", err);
    return [];
  }
}
