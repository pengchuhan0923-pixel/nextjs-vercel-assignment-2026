import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

type StudyResource = {
  id: number;
  title: string;
  description: string;
  category: string;
};

export const dynamic = "force-dynamic";

export default async function ProtectedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data, error }, { data: profile, error: profileError }] = await Promise.all([
    supabase.from("study_resources").select("id, title, description, category").order("id"),
    supabase.from("profiles").select("first_name, last_name, avatar_url").eq("id", user.id).maybeSingle(),
  ]);

  if (error) {
    throw new Error(`Unable to load study resources: ${error.message}`);
  }

  if (profileError) {
    throw new Error(`Unable to load profile: ${profileError.message}`);
  }

  if (!profile?.first_name || !profile?.last_name) {
    redirect("/profile");
  }

  const resources = (data ?? []) as StudyResource[];

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <section className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-300">
              Gated UI · signed in
            </p>
            <h1 className="mt-3 text-4xl font-bold sm:text-6xl">Private Study Resources</h1>
            <p className="mt-3 text-slate-300">
              Welcome, {profile.first_name} {profile.last_name}
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/profile" className="rounded-xl bg-emerald-300 px-5 py-3 font-semibold text-slate-950 hover:bg-emerald-200">
              Profile
            </Link>
            <form action={signOut}>
              <button className="rounded-xl border border-white/20 px-5 py-3 font-semibold hover:bg-white/10">
                Sign out
              </button>
            </form>
          </div>
        </div>

        <ul className="mt-12 grid gap-6 sm:grid-cols-2">
          {resources.map((resource) => (
            <li key={resource.id} className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                {resource.category}
              </span>
              <h2 className="mt-4 text-2xl font-semibold">{resource.title}</h2>
              <p className="mt-3 leading-7 text-slate-300">{resource.description}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
