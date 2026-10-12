"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const GEMINI_MODEL = "gemini-3.8-flash";

function captionsUrl(message: string, type: "success" | "error" = "success") {
  return `/captions?${type}=${encodeURIComponent(message)}`;
}

export async function generateCaption(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const scene = String(formData.get("scene") ?? "").trim();
  const vibe = String(formData.get("vibe") ?? "witty").trim();
  if (scene.length < 8 || scene.length > 300) redirect(captionsUrl("Describe your scene in 8–300 characters.", "error"));

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) redirect(captionsUrl("AI generation is not configured yet.", "error"));

  const prompt = [
    "Write one original social-media caption for a Columbia University student in New York City.",
    `Scene: ${scene}`,
    `Vibe: ${vibe}`,
    "Return only the caption, with no quotation marks, labels, hashtags, or explanation.",
    "Keep it playful, safe, and under 180 characters.",
  ].join("\n");

  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({ model: GEMINI_MODEL, input: prompt, store: false }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Gemini returned ${response.status}`);

    const result = (await response.json()) as {
      steps?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
    };
    const text = result.steps
      ?.filter((step) => step.type === "model_output")
      .flatMap((step) => step.content ?? [])
      .find((content) => content.type === "text")
      ?.text?.trim();
    if (!text) throw new Error("Gemini returned an empty response");

    const { error } = await supabase.from("captions").insert({
      text: text.slice(0, 500), context: scene, prompt, model: GEMINI_MODEL, created_by: user.id, is_ai_generated: true,
    });
    if (error) throw new Error(error.message);
  } catch (error) {
    console.error("Caption generation failed", error);
    redirect(captionsUrl("The caption could not be generated. Please try again.", "error"));
  }

  revalidatePath("/captions");
  redirect(captionsUrl("Your AI caption is live and ready for votes."));
}

export async function voteCaption(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const captionId = Number(formData.get("captionId"));
  const direction = String(formData.get("direction"));
  const vote = direction === "up" ? 1 : direction === "down" ? -1 : 0;
  if (!Number.isInteger(captionId) || captionId < 1 || vote === 0) redirect(captionsUrl("That vote was invalid.", "error"));

  const { error } = await supabase.from("caption_votes").insert({ caption_id: captionId, user_id: user.id, vote });
  if (error) redirect(captionsUrl(`Unable to save vote: ${error.message}`, "error"));

  revalidatePath("/captions");
  redirect(captionsUrl("Vote saved."));
}
