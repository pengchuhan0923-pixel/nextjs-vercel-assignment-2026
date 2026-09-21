import { getSupabaseClient } from "@/lib/supabase";

type StudyResource = {
  id: number;
  title: string;
  description: string;
  category: string;
};

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("study_resources")
    .select("id, title, description, category")
    .order("id");

  if (error) {
    throw new Error(`Unable to load study resources: ${error.message}`);
  }

  const resources = (data ?? []) as StudyResource[];

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-20 text-white">
      <section className="mx-auto max-w-5xl">
        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-emerald-300">
          Next.js + Supabase + Vercel
        </p>
        <h1 className="mt-4 text-5xl font-bold tracking-tight sm:text-7xl">
          Study Resources
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
          This list is fetched live from the study_resources table in Supabase.
        </p>

        <ul className="mt-12 grid gap-6 sm:grid-cols-2">
          {resources.map((resource) => (
            <li
              key={resource.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/20"
            >
              <span className="inline-flex rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-300">
                {resource.category}
              </span>
              <h2 className="mt-5 text-2xl font-semibold">{resource.title}</h2>
              <p className="mt-3 leading-7 text-slate-300">
                {resource.description}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
