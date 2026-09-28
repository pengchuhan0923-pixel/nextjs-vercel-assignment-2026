"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const firstName = String(formData.get("firstName") ?? "").trim() || null;
  const lastName = String(formData.get("lastName") ?? "").trim() || null;
  const avatar = formData.get("avatar");
  let avatarUrl: string | undefined;

  if (avatar instanceof File && avatar.size > 0) {
    if (!avatar.type.startsWith("image/")) {
      throw new Error("Please choose an image file.");
    }

    if (avatar.size > MAX_AVATAR_SIZE) {
      throw new Error("The profile photo must be smaller than 5 MB.");
    }

    const extension = avatar.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const filePath = `${user.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, avatar, { contentType: avatar.type, upsert: false });

    if (uploadError) {
      throw new Error(`Unable to upload profile photo: ${uploadError.message}`);
    }

    avatarUrl = supabase.storage.from("avatars").getPublicUrl(filePath).data.publicUrl;
  }

  const profile = {
    id: user.id,
    first_name: firstName,
    last_name: lastName,
    updated_at: new Date().toISOString(),
    ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
  };

  const { error } = await supabase.from("profiles").upsert(profile);

  if (error) {
    throw new Error(`Unable to update profile: ${error.message}`);
  }

  redirect("/protected");
}
