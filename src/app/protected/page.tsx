import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

type Caption = { id: number; text: string; context: string | null; created_at: string };
type CaptionVote = { caption_id: number; user_id: string; vote: number; created_at: string };

export const dynamic = "force-dynamic";

export default async function ProtectedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: captions, error: captionError },
    { data: votes, error: voteError },
    { data: profile, error: profileError },
  ] = await Promise.all([
    supabase.from("captions").select("id, text, context, created_at").eq("is_ai_generated", true).order("created_at", { ascending: false }),
    supabase.from("caption_votes").select("caption_id, user_id, vote, created_at").order("created_at", { ascending: false }),
    supabase.from("profiles").select("first_name, last_name").eq("id", user.id).maybeSingle(),
  ]);

  if (captionError) throw new Error(`Unable to load captions: ${captionError.message}`);
  if (voteError) throw new Error(`Unable to load votes: ${voteError.message}`);
  if (profileError) throw new Error(`Unable to load profile: ${profileError.message}`);
  if (!profile?.first_name || !profile?.last_name) redirect("/profile");

  const captionList = ((captions ?? []) as Caption[]).filter(
    (caption) => !/thinking process|analyze the request/i.test(caption.text),
  );
  const visibleCaptionIds = new Set(captionList.map((caption) => caption.id));
  const latestVotes = new Map<string, CaptionVote>();
  for (const vote of (votes ?? []) as CaptionVote[]) {
    if (!visibleCaptionIds.has(vote.caption_id)) continue;
    const key = `${vote.caption_id}:${vote.user_id}`;
    if (!latestVotes.has(key)) latestVotes.set(key, vote);
  }

  const scores = new Map<number, number>();
  for (const vote of latestVotes.values()) {
    scores.set(vote.caption_id, (scores.get(vote.caption_id) ?? 0) + vote.vote);
  }

  const leaderboard = [...captionList].sort((a, b) => {
    const scoreDifference = (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0);
    return scoreDifference || new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  const champion = leaderboard[0];
  const championScore = champion ? scores.get(champion.id) ?? 0 : 0;

  return (
    <main className="min-h-screen bg-[#07111f] px-5 py-8 text-white sm:px-8 sm:py-10">
      <section className="mx-auto max-w-6xl">
        <nav className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">Campus Caption Clash</p>
            <p className="mt-1 text-sm text-slate-400">Welcome back, {profile.first_name}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/captions" className="rounded-full bg-gradient-to-r from-fuchsia-300 to-cyan-300 px-5 py-2.5 text-sm font-black text-slate-950 hover:brightness-110">Create & vote</Link>
            <Link href="/profile" className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10">Profile</Link>
            <form action={signOut}><button className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10">Sign out</button></form>
          </div>
        </nav>

        <header className="mt-14 max-w-3xl">
          <p className="text-sm font-black uppercase tracking-[0.28em] text-fuchsia-300">Community leaderboard</p>
          <h1 className="mt-4 text-5xl font-black leading-none sm:text-7xl">The caption everyone loves.</h1>
          <p className="mt-5 text-lg leading-8 text-slate-300">The highest-rated AI caption takes center stage. Vote in the full feed to decide what appears here next.</p>
        </header>

        {champion ? (
          <section className="relative mt-10 overflow-hidden rounded-[2rem] border border-amber-300/35 bg-gradient-to-br from-amber-300/20 via-fuchsia-300/10 to-cyan-300/10 p-7 shadow-2xl shadow-fuchsia-950/30 sm:p-10">
            <div className="absolute right-0 top-0 h-48 w-48 translate-x-16 -translate-y-16 rounded-full bg-amber-300/20 blur-3xl" />
            <div className="relative">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <span className="rounded-full bg-amber-300 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-950">★ Current champion</span>
                <span className="rounded-full bg-white/10 px-4 py-2 text-lg font-black text-amber-200">{championScore > 0 ? `+${championScore}` : championScore} score</span>
              </div>
              <blockquote className="mt-8 max-w-4xl text-3xl font-black leading-tight sm:text-5xl">“{champion.text}”</blockquote>
              <p className="mt-6 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base"><strong className="text-white">Inspired by:</strong> {champion.context || "A campus moment worth captioning."}</p>
              <Link href="/captions?sort=top" className="mt-8 inline-flex rounded-xl bg-white px-5 py-3 font-black text-slate-950 hover:bg-cyan-100">See the full leaderboard →</Link>
            </div>
          </section>
        ) : (
          <section className="mt-10 rounded-[2rem] border border-dashed border-white/20 bg-white/[0.04] p-12 text-center">
            <h2 className="text-2xl font-black">The crown is still waiting.</h2>
            <p className="mt-3 text-slate-300">Generate the first AI caption and start the vote.</p>
            <Link href="/captions" className="mt-6 inline-flex rounded-xl bg-cyan-300 px-5 py-3 font-black text-slate-950">Create the first caption</Link>
          </section>
        )}

        {leaderboard.length > 1 && (
          <section className="mt-12">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div><p className="text-sm font-black uppercase tracking-[0.24em] text-cyan-300">Close contenders</p><h2 className="mt-2 text-3xl font-black">Next up for the crown</h2></div>
              <span className="text-sm text-slate-400">Updated from community votes</span>
            </div>
            <ol className="mt-6 grid gap-5 md:grid-cols-3">
              {leaderboard.slice(1, 4).map((caption, index) => {
                const score = scores.get(caption.id) ?? 0;
                return <li key={caption.id} className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
                  <div className="flex items-center justify-between"><span className="text-xs font-black uppercase tracking-widest text-fuchsia-300">#{index + 2}</span><span className="rounded-full bg-white/10 px-3 py-1 text-sm font-black">{score > 0 ? `+${score}` : score}</span></div>
                  <p className="mt-5 text-xl font-black leading-8">“{caption.text}”</p>
                </li>;
              })}
            </ol>
          </section>
        )}
      </section>
    </main>
  );
}
