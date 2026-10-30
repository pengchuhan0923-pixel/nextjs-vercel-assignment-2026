"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const AI_MODEL = "gpt-6-luna";

class CaptionGenerationError extends Error {
  constructor(public readonly userMessage: string, message: string) {
    super(message);
  }
}

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

  const openAIKey = process.env.OPENAI_API_KEY;
  if (!openAIKey) redirect(captionsUrl("AI generation is not configured. Please contact the site owner.", "error"));

  const prompt = [
    "Write one original social-media caption for a Columbia University student in New York City.",
    `Scene: ${scene}`,
    `Vibe: ${vibe}`,
    "Return only the caption, with no quotation marks, labels, hashtags, or explanation.",
    "Keep it playful, safe, and under 180 characters.",
  ].join("\n");

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAIKey}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        input: prompt,
        reasoning: { effort: "none" },
        max_output_tokens: 120,
        store: false,
      }),
      cache: "no-store",
    });
    if (!response.ok) {
      const requestId = response.headers.get("x-request-id") ?? "unavailable";
      const messages: Record<number, string> = {
        400: "The AI request was rejected. Please adjust the scene and try again.",
        401: "AI generation is not configured correctly. Please contact the site owner.",
        403: "The AI service denied this request. Please contact the site owner.",
        429: "The AI service is temporarily rate-limited or out of credits. Please try again later.",
      };
      const userMessage = messages[response.status]
        ?? (response.status >= 500
          ? "The AI service is temporarily unavailable. Please try again shortly."
          : "The AI service could not process this request. Please try again.");
      throw new CaptionGenerationError(userMessage, `OpenAI returned ${response.status}; request ${requestId}`);
    }

    const result = (await response.json()) as {
      output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
    };
    const content = result.output
      ?.flatMap((item) => item.content ?? [])
      .find((item) => item.type === "output_text")
      ?.text?.trim();
    if (!content) {
      throw new CaptionGenerationError(
        "The AI returned no caption. Please try again.",
        "OpenAI returned an empty response",
      );
    }

    let text = content;
    try {
      const parsed = JSON.parse(content) as { caption?: string };
      text = parsed.caption ?? content;
    } catch {
      // The cleanup below also supports providers that return plain text.
    }
    text = cleanCaption(text);
    if (!text || /thinking process|analyze the request/i.test(text)) {
      throw new CaptionGenerationError(
        "The AI response was not display-ready. Please try again.",
        "OpenAI did not return a display-ready caption",
      );
    }

    const { error } = await supabase.from("captions").insert({
      text: text.slice(0, 180), context: scene, prompt, model: AI_MODEL, created_by: user.id, is_ai_generated: true,
    });
    if (error) {
      throw new CaptionGenerationError(
        "The caption was generated but could not be saved. Please try again.",
        `Supabase insert failed: ${error.message}`,
      );
    }
  } catch (error) {
    console.error("Caption generation failed", error);
    const message = error instanceof CaptionGenerationError
      ? error.userMessage
      : "Could not reach the AI service. Check your connection and try again.";
    redirect(captionsUrl(message, "error"));
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
