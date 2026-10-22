"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getEventAuthorization } from "@/lib/guest-session";

export async function updatePrivacySetting(eventId: string, field: string, value: unknown) {
  try {
    const { event, isOwner } = await getEventAuthorization(eventId);
    if (!event || !isOwner) return { success: false };
    if (typeof value !== "boolean" || !["biometricSearch", "publicGallery"].includes(field)) {
      return { success: false };
    }

    await prisma.event.update({
      where: { id: eventId },
      data: field === "biometricSearch" ? { biometricSearch: value } : { publicGallery: value },
    });
    
    revalidatePath(`/admin/${eventId}/access`);
    return { success: true };
  } catch (error) {
    console.error("[PRIVACY_SETTING_UPDATE_ERROR]:", error);
    return { success: false };
  }
}