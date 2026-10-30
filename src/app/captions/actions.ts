"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Use a free instruction-tuned model with reasoning disabled so the short
// completion budget is spent on the caption instead of hidden thinking.
const AI_MODEL = "google/gemma-4-26b-a4b-it:free";

function cleanCaption(value: string) {
  return value
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .replace(/^caption\s*:\s*/i, "")
    .replace(/^["“]|["”]$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

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

  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterKey) redirect(captionsUrl("AI generation is not configured yet.", "error"));

  const prompt = [
    "Write one original social-media caption for a Columbia University student in New York City.",
    `Scene: ${scene}`,
    `Vibe: ${vibe}`,
    "Return only the caption, with no quotation marks, labels, hashtags, or explanation.",
    "Keep it playful, safe, and under 180 characters.",
  ].join("\n");

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openRouterKey}`,
        "HTTP-Referer": "https://nextjs-vercel-assignment-2026.vercel.app",
        "X-Title": "Campus Caption Clash",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 500,
        reasoning: { enabled: false },
        temperature: 0.9,
      }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`OpenRouter returned ${response.status}`);

    const result = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = result.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("OpenRouter returned an empty response");

    let text = content;
    try {
      const parsed = JSON.parse(content) as { caption?: string };
      text = parsed.caption ?? content;
    } catch {
      // The cleanup below also supports providers that return plain text.
    }
    text = cleanCaption(text);
    if (!text || /thinking process|analyze the request/i.test(text)) {
      throw new Error("OpenRouter did not return a display-ready caption");
    }

    const { error } = await supabase.from("captions").insert({
      text: text.slice(0, 180), context: scene, prompt, model: AI_MODEL, created_by: user.id, is_ai_generated: true,
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
