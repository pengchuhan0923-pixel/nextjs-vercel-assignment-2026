import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generateCaption, voteCaption } from "./actions";

type Caption = { id: number; text: string; context: string | null; prompt: string | null; model: string | null; created_at: string };
type CaptionVote = { caption_id: number; user_id: string; vote: number; created_at: string };
type SortMode = "new" | "top";

const dailyPrompts = [
  "Your professor says ‘quick question’ with two minutes left",
  "The 1 train doors close right in front of you",
  "Butler Library at 3 a.m. during midterms",
  "The first sunny day takes over College Walk",
  "A mystery creation appears in the dining hall",
];

export const dynamic = "force-dynamic";

export default async function CaptionsPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string; sort?: string }> }) {
  const params = await searchParams;
  const sortMode: SortMode = params.sort === "top" ? "top" : "new";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: captions, error: captionError }, { data: votes, error: voteError }] = await Promise.all([
    supabase.from("captions").select("id, text, context, prompt, model, created_at").eq("is_ai_generated", true).order("created_at", { ascending: false }),
    supabase.from("caption_votes").select("caption_id, user_id, vote, created_at").order("created_at", { ascending: false }),
  ]);
  if (captionError) throw new Error(`Unable to load captions: ${captionError.message}`);
  if (voteError) throw new Error(`Unable to load votes: ${voteError.message}`);

  const rawCaptions = (captions ?? []) as Caption[];
  const captionList = rawCaptions.filter((caption) => !/thinking process|analyze the request/i.test(caption.text));
  const voteList = (votes ?? []) as CaptionVote[];
  const latestVotes = new Map<string, CaptionVote>();
  for (const vote of voteList) {
    const key = `${vote.caption_id}:${vote.user_id}`;
    if (!latestVotes.has(key)) latestVotes.set(key, vote);
  }

  const scores = new Map<number, number>();
  for (const vote of latestVotes.values()) scores.set(vote.caption_id, (scores.get(vote.caption_id) ?? 0) + vote.vote);
  const sortedCaptions = [...captionList].sort((a, b) => sortMode === "top"
    ? (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0)
    : new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const totalVotes = latestVotes.size;
  const topScore = Math.max(0, ...scores.values());
  const challengeIndex = captionList.length % dailyPrompts.length;

  return (
    <main className="min-h-screen bg-[#07111f] px-5 py-8 text-white sm:px-8 sm:py-10">
      <section className="mx-auto max-w-6xl">
        <nav className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/protected" className="text-sm font-bold tracking-wide text-cyan-300 hover:text-cyan-200">← Study Hub</Link>
          <div className="flex items-center gap-3"><Link href="/profile" className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10">Profile</Link><span className="rounded-full bg-lime-300 px-4 py-2 text-sm font-bold text-slate-950">Signed in</span></div>
        </nav>

        <header className="mt-12 grid gap-8 lg:grid-cols-[1.15fr_.85fr] lg:items-end">
          <div><p className="text-sm font-black uppercase tracking-[0.28em] text-fuchsia-300">Columbia meets NYC</p><h1 className="mt-4 text-5xl font-black leading-none sm:text-7xl">Campus Caption Clash</h1><p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">Create a caption from campus chaos, vote on the community feed, and come back for a new daily challenge.</p></div>
          <aside className="rounded-3xl border border-cyan-300/25 bg-cyan-300/10 p-5 text-sm leading-6 text-cyan-100"><strong className="block text-base text-white">Community challenge</strong><span className="mt-2 block">{dailyPrompts[challengeIndex]}</span><span className="mt-3 block text-xs font-bold uppercase tracking-widest text-cyan-300">A fresh reason to create</span></aside>
        </header>

        {(params.success || params.error) && <p role="status" className={`mt-8 rounded-2xl border p-4 ${params.error ? "border-rose-300/30 bg-rose-300/10 text-rose-100" : "border-lime-300/30 bg-lime-300/10 text-lime-100"}`}>{params.error ?? params.success}</p>}

        <section className="mt-10 rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-fuchsia-950/20 sm:p-8">
          <div className="grid gap-7 lg:grid-cols-[.75fr_1.25fr]">
            <div><p className="text-sm font-black uppercase tracking-[0.24em] text-lime-300">Create with AI</p><h2 className="mt-3 text-3xl font-black">What just happened?</h2><p className="mt-3 leading-7 text-slate-300">Describe a real campus or NYC moment. AI turns it into one short caption ready for community voting.</p><div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-300">{["Butler at 3 a.m.", "A delayed 1 train", "Dining hall mystery", "First sunny day"].map((idea) => <span key={idea} className="rounded-full bg-white/10 px-3 py-2">{idea}</span>)}</div></div>
            <form action={generateCaption} className="space-y-4">
              <label className="block text-sm font-bold" htmlFor="scene">Describe the scene</label>
              <textarea id="scene" name="scene" required minLength={8} maxLength={300} rows={4} placeholder="Example: My roommate brought a desk chair onto the subway because the dorm elevator broke." className="w-full rounded-2xl border border-white/15 bg-slate-950/60 p-4 text-white outline-none placeholder:text-slate-500 focus:border-cyan-300" />
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end"><label className="flex-1 text-sm font-bold">Vibe<select name="vibe" className="mt-2 block w-full rounded-xl border border-white/15 bg-slate-950 p-3 text-white"><option value="witty and chronically online">Witty</option><option value="dry and understated">Dry</option><option value="dramatic but friendly">Dramatic</option><option value="wholesome and playful">Wholesome</option></select></label><button className="rounded-xl bg-gradient-to-r from-fuchsia-300 to-cyan-300 px-6 py-3 font-black text-slate-950 transition hover:-translate-y-0.5 hover:brightness-110">Generate caption ✦</button></div>
            </form>
          </div>
        </section>

        <section className="mt-10 grid gap-3 sm:grid-cols-3" aria-label="Community stats">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><span className="text-2xl font-black text-cyan-300">{captionList.length}</span><p className="text-sm text-slate-400">AI captions</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><span className="text-2xl font-black text-lime-300">{totalVotes}</span><p className="text-sm text-slate-400">community votes</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><span className="text-2xl font-black text-fuchsia-300">+{topScore}</span><p className="text-sm text-slate-400">top score</p></div>
        </section>

        <div className="mt-12 flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-sm font-black uppercase tracking-[0.24em] text-cyan-300">Community feed</p><h2 className="mt-2 text-3xl font-black">Vote the vibe</h2></div>
          <div className="flex rounded-full border border-white/10 bg-white/5 p-1" aria-label="Sort captions"><Link href="/captions?sort=new" className={`rounded-full px-4 py-2 text-sm font-bold ${sortMode === "new" ? "bg-white text-slate-950" : "text-slate-300 hover:text-white"}`}>Newest</Link><Link href="/captions?sort=top" className={`rounded-full px-4 py-2 text-sm font-bold ${sortMode === "top" ? "bg-white text-slate-950" : "text-slate-300 hover:text-white"}`}>Top rated</Link></div>
        </div>

        {sortedCaptions.length === 0 ? <div className="mt-6 rounded-3xl border border-dashed border-white/20 p-12 text-center text-slate-300">No display-ready captions yet. Take today’s challenge and create the first one.</div> : (
          <ul className="mt-6 grid gap-6 md:grid-cols-2">{sortedCaptions.map((caption, index) => {
            const score = scores.get(caption.id) ?? 0;
            const latestUserVote = latestVotes.get(`${caption.id}:${user.id}`)?.vote;
            return <li key={caption.id} className="flex flex-col rounded-3xl border border-white/10 bg-white/[0.06] p-6 transition hover:border-cyan-300/30 hover:bg-white/[0.08]">
              <div className="flex items-center justify-between gap-3"><p className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-300">AI generated</p>{sortMode === "top" && index === 0 && <span className="rounded-full bg-amber-300 px-3 py-1 text-xs font-black text-slate-950">Top pick</span>}</div>
              <blockquote className="mt-4 text-2xl font-black leading-9">“{caption.text}”</blockquote>
              <p className="mt-4 text-sm leading-6 text-slate-400"><strong className="text-slate-200">Original scene:</strong> {caption.context}</p>
              <details className="mt-3 text-xs text-slate-500"><summary className="cursor-pointer hover:text-slate-300">Why this was generated</summary><pre className="mt-2 whitespace-pre-wrap rounded-xl bg-black/20 p-3 font-sans">{caption.prompt}</pre></details>
              <div className="mt-auto flex flex-wrap items-center gap-2 pt-6">
                <form action={voteCaption}><input type="hidden" name="captionId" value={caption.id} /><button name="direction" value="up" aria-label="Vote Fire" className={`rounded-xl px-4 py-2 font-black text-slate-950 ${latestUserVote === 1 ? "bg-lime-200 ring-2 ring-white" : "bg-lime-300 hover:bg-lime-200"}`}>▲ Fire</button></form>
                <form action={voteCaption}><input type="hidden" name="captionId" value={caption.id} /><button name="direction" value="down" aria-label="Vote Skip" className={`rounded-xl px-4 py-2 font-black text-slate-950 ${latestUserVote === -1 ? "bg-rose-200 ring-2 ring-white" : "bg-rose-300 hover:bg-rose-200"}`}>▼ Skip</button></form>
                <span className="ml-auto rounded-full bg-white/10 px-3 py-2 text-sm font-black" aria-label={`Score ${score}`}>{score > 0 ? `+${score}` : score}</span>
              </div>
              <p className="mt-3 text-xs text-slate-500">{latestUserVote === 1 ? "Your latest vote: Fire" : latestUserVote === -1 ? "Your latest vote: Skip" : "Choose Fire or Skip"}</p>
            </li>;
          })}</ul>
        )}
      </section>
    </main>
  );
}
