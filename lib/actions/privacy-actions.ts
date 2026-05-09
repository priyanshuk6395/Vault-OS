"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function updatePrivacySetting(eventId: string, field: string, value: any) {
  try {
    await prisma.event.update({
      where: { id: eventId },
      data: { [field]: value }
    });
    
    revalidatePath(`/admin/${eventId}/access`);
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}