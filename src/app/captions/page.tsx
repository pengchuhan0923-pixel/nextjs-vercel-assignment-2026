import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { voteCaption } from "./actions";

type Caption = {
  id: number;
  text: string;
  context: string | null;
};

type CaptionVote = {
  caption_id: number;
  user_id: string;
  vote: number;
  created_at: string;
};

export const dynamic = "force-dynamic";

export default async function CaptionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: captions, error: captionError }, { data: votes, error: voteError }] =
    await Promise.all([
      supabase.from("captions").select("id, text, context").order("id"),
      supabase
        .from("caption_votes")
        .select("caption_id, user_id, vote, created_at")
        .order("created_at", { ascending: false }),
    ]);

  if (captionError) {
    throw new Error(`Unable to load captions: ${captionError.message}`);
  }

  if (voteError) {
    throw new Error(`Unable to load votes: ${voteError.message}`);
  }

  const captionList = (captions ?? []) as Caption[];
  const voteList = (votes ?? []) as CaptionVote[];

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <section className="mx-auto max-w-4xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-300">
              Authenticated mutations
            </p>
            <h1 className="mt-3 text-4xl font-bold sm:text-6xl">Rate the captions</h1>
            <p className="mt-4 max-w-2xl leading-7 text-slate-300">
              Every upvote or downvote inserts a new row in the caption_votes table and connects it to your account.
            </p>
          </div>
          <Link href="/protected" className="rounded-xl border border-white/20 px-5 py-3 font-semibold hover:bg-white/10">
            Study resources
          </Link>
        </div>

        <ul className="mt-12 space-y-6">
          {captionList.map((caption) => {
            const captionVotes = voteList.filter((item) => item.caption_id === caption.id);
            const score = captionVotes.reduce((total, item) => total + item.vote, 0);
            const latestUserVote = captionVotes.find((item) => item.user_id === user.id)?.vote;

            return (
              <li key={caption.id} className="rounded-3xl border border-white/10 bg-white/5 p-7 shadow-xl shadow-black/20">
                {caption.context && (
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-300">
                    {caption.context}
                  </p>
                )}
                <blockquote className="mt-3 text-2xl font-semibold leading-9">
                  “{caption.text}”
                </blockquote>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <form action={voteCaption}>
                    <input type="hidden" name="captionId" value={caption.id} />
                    <button
                      name="direction"
                      value="up"
                      className="rounded-xl bg-emerald-300 px-5 py-3 font-semibold text-slate-950 hover:bg-emerald-200"
                    >
                      ▲ Upvote
                    </button>
                  </form>
                  <form action={voteCaption}>
                    <input type="hidden" name="captionId" value={caption.id} />
                    <button
                      name="direction"
                      value="down"
                      className="rounded-xl bg-rose-300 px-5 py-3 font-semibold text-slate-950 hover:bg-rose-200"
                    >
                      ▼ Downvote
                    </button>
                  </form>
                  <span className="ml-auto rounded-full bg-white/10 px-4 py-2 text-sm font-semibold">
                    Score: {score > 0 ? `+${score}` : score}
                  </span>
                </div>

                <p className="mt-4 text-sm text-slate-400">
                  {latestUserVote === 1
                    ? "Your latest vote: upvote"
                    : latestUserVote === -1
                      ? "Your latest vote: downvote"
                      : "You have not rated this caption yet."}
                </p>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
