import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex min-h-screen items-center bg-slate-950 px-6 text-white">
      <section className="mx-auto w-full max-w-5xl py-20">
        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-emerald-300">
          Next.js + Supabase Auth
        </p>
        <h1 className="mt-4 text-5xl font-bold tracking-tight sm:text-7xl">
          A protected resource library with Google sign-in.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
          The public landing page is visible to everyone. The study-resources route is gated by a verified Supabase session.
        </p>

        <Link
          href={user ? "/protected" : "/login"}
          className="mt-10 inline-flex rounded-xl bg-emerald-300 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-200"
        >
          {user ? "Open protected page" : "Sign in with Google"}
        </Link>
      </section>
    </main>
  );
}
