import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generateCaption, voteCaption } from "./actions";

type Caption = { id: number; text: string; context: string | null; prompt: string | null; model: string | null; created_at: string };
type CaptionVote = { caption_id: number; user_id: string; vote: number; created_at: string };

export const dynamic = "force-dynamic";

export default async function CaptionsPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: captions, error: captionError }, { data: votes, error: voteError }] = await Promise.all([
    supabase.from("captions").select("id, text, context, prompt, model, created_at").eq("is_ai_generated", true).order("created_at", { ascending: false }),
    supabase.from("caption_votes").select("caption_id, user_id, vote, created_at").order("created_at", { ascending: false }),
  ]);
  if (captionError) throw new Error(`Unable to load captions: ${captionError.message}`);
  if (voteError) throw new Error(`Unable to load votes: ${voteError.message}`);

  const captionList = (captions ?? []) as Caption[];
  const voteList = (votes ?? []) as CaptionVote[];

  return (
    <main className="min-h-screen bg-[#07111f] px-5 py-10 text-white sm:px-8">
      <section className="mx-auto max-w-6xl">
        <nav className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/protected" className="text-sm font-bold tracking-wide text-cyan-300">← Study Hub</Link>
          <div className="flex gap-3"><Link href="/profile" className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10">Profile</Link><span className="rounded-full bg-lime-300 px-4 py-2 text-sm font-bold text-slate-950">Signed in</span></div>
        </nav>

        <header className="mt-12 grid gap-8 lg:grid-cols-[1.15fr_.85fr] lg:items-end">
          <div><p className="text-sm font-black uppercase tracking-[0.28em] text-fuchsia-300">Columbia meets NYC</p><h1 className="mt-4 text-5xl font-black leading-none sm:text-7xl">Campus Caption Clash</h1><p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">Turn chaotic campus and city moments into AI captions, then let the community decide which ones deserve the group chat.</p></div>
          <div className="rounded-3xl border border-cyan-300/25 bg-cyan-300/10 p-5 text-sm leading-6 text-cyan-100"><strong className="block text-base text-white">Built for Sam</strong>A chronically-online Columbia junior exploring New York between classes. Fresh prompts and community voting make every visit different.</div>
        </header>

        {(params.success || params.error) && <p className={`mt-8 rounded-2xl border p-4 ${params.error ? "border-rose-300/30 bg-rose-300/10 text-rose-100" : "border-lime-300/30 bg-lime-300/10 text-lime-100"}`}>{params.error ?? params.success}</p>}

        <section className="mt-10 rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-fuchsia-950/20 sm:p-8">
          <div className="grid gap-7 lg:grid-cols-[.75fr_1.25fr]">
            <div><p className="text-sm font-black uppercase tracking-[0.24em] text-lime-300">Create with AI</p><h2 className="mt-3 text-3xl font-black">What just happened?</h2><p className="mt-3 leading-7 text-slate-300">Describe a real campus or NYC moment. Gemini will turn it into one short, shareable caption.</p><div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-300">{["Butler at 3 a.m.", "A delayed 1 train", "Dining hall mystery", "First sunny day"].map((idea) => <span key={idea} className="rounded-full bg-white/10 px-3 py-2">{idea}</span>)}</div></div>
            <form action={generateCaption} className="space-y-4">
              <label className="block text-sm font-bold" htmlFor="scene">Describe the scene</label>
              <textarea id="scene" name="scene" required minLength={8} maxLength={300} rows={4} placeholder="Example: My roommate brought a desk chair onto the subway because the dorm elevator broke." className="w-full rounded-2xl border border-white/15 bg-slate-950/60 p-4 text-white outline-none placeholder:text-slate-500 focus:border-cyan-300" />
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end"><label className="flex-1 text-sm font-bold">Vibe<select name="vibe" className="mt-2 block w-full rounded-xl border border-white/15 bg-slate-950 p-3 text-white"><option value="witty and chronically online">Witty</option><option value="dry and understated">Dry</option><option value="dramatic but friendly">Dramatic</option><option value="wholesome and playful">Wholesome</option></select></label><button className="rounded-xl bg-gradient-to-r from-fuchsia-300 to-cyan-300 px-6 py-3 font-black text-slate-950 hover:brightness-110">Generate caption ✦</button></div>
            </form>
          </div>
        </section>

        <div className="mt-14 flex items-end justify-between gap-4"><div><p className="text-sm font-black uppercase tracking-[0.24em] text-cyan-300">Community feed</p><h2 className="mt-2 text-3xl font-black">Vote the vibe</h2></div><span className="text-sm text-slate-400">{captionList.length} AI generations</span></div>
        {captionList.length === 0 ? <div className="mt-6 rounded-3xl border border-dashed border-white/20 p-12 text-center text-slate-300">No AI captions yet. Create the first one above.</div> : (
          <ul className="mt-6 grid gap-6 md:grid-cols-2">{captionList.map((caption) => {
            const captionVotes = voteList.filter((item) => item.caption_id === caption.id);
            const score = captionVotes.reduce((total, item) => total + item.vote, 0);
            const latestUserVote = captionVotes.find((item) => item.user_id === user.id)?.vote;
            return <li key={caption.id} className="flex flex-col rounded-3xl border border-white/10 bg-white/[0.06] p-6"><p className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-300">AI generated · {caption.model}</p><blockquote className="mt-4 text-2xl font-black leading-9">“{caption.text}”</blockquote><p className="mt-4 text-sm leading-6 text-slate-400"><strong className="text-slate-200">Original scene:</strong> {caption.context}</p><details className="mt-3 text-xs text-slate-500"><summary className="cursor-pointer hover:text-slate-300">View saved AI prompt</summary><pre className="mt-2 whitespace-pre-wrap rounded-xl bg-black/20 p-3 font-sans">{caption.prompt}</pre></details><div className="mt-auto flex flex-wrap items-center gap-2 pt-6"><form action={voteCaption}><input type="hidden" name="captionId" value={caption.id} /><button name="direction" value="up" className="rounded-xl bg-lime-300 px-4 py-2 font-black text-slate-950 hover:bg-lime-200">▲ Fire</button></form><form action={voteCaption}><input type="hidden" name="captionId" value={caption.id} /><button name="direction" value="down" className="rounded-xl bg-rose-300 px-4 py-2 font-black text-slate-950 hover:bg-rose-200">▼ Skip</button></form><span className="ml-auto rounded-full bg-white/10 px-3 py-2 text-sm font-black">{score > 0 ? `+${score}` : score}</span></div><p className="mt-3 text-xs text-slate-500">{latestUserVote === 1 ? "You voted Fire" : latestUserVote === -1 ? "You voted Skip" : "You have not voted yet"}</p></li>;
          })}</ul>
        )}
      </section>
    </main>
  );
}
