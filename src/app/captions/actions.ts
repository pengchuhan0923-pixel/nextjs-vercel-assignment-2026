"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function voteCaption(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const captionId = Number(formData.get("captionId"));
  const direction = String(formData.get("direction"));
  const vote = direction === "up" ? 1 : direction === "down" ? -1 : 0;

  if (!Number.isInteger(captionId) || captionId < 1 || vote === 0) {
    throw new Error("Invalid caption vote.");
  }

  const { error } = await supabase.from("caption_votes").insert({
    caption_id: captionId,
    user_id: user.id,
    vote,
  });

  if (error) {
    throw new Error(`Unable to save vote: ${error.message}`);
  }

  revalidatePath("/captions");
}
